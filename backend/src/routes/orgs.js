const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const { getActiveOrg, getOrgUsage, addMember, removeMember } = require('../services/org');
const { getFreeStatus } = require('../services/freeAllowance');
const { getDailyCap } = require('../services/plans');
const { logger } = require('../logger');

// All routes are JWT-authenticated. Orgs are created by admins
// (/api/admin/orgs); leaders manage members by registered email.
router.use(authenticate);

async function requireOrg(userId, needLeader = false) {
  const org = await getActiveOrg(userId);
  if (!org) return { error: { status: 404, body: { error: 'No active org' } } };
  if (needLeader && org.role !== 'leader') {
    return { error: { status: 403, body: { error: 'Org leader only' } } };
  }
  return { org };
}

// GET /api/orgs/mine — my org + members + shared bucket snapshot.
router.get('/mine', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const { org } = found;
    const members = await pool.query(
      `SELECT u.id, u.email, m.role, m.joined_at
         FROM org_members m JOIN users u ON u.id = m.user_id
        WHERE m.org_id = $1 AND m.status = 'active'
        ORDER BY m.joined_at ASC`,
      [org.id]
    );
    // Shared bucket snapshot (leader's row + leader cap).
    let bucket = null;
    try {
      const cap = await getDailyCap(org.leader_user_id);
      const status = await getFreeStatus({ userId: org.leader_user_id, guestKey: null, cap });
      bucket = { limit: status.limit, used: status.used, remaining: status.remaining };
    } catch (e) {}
    res.json({ success: true, org: { id: org.id, name: org.name, leader_user_id: org.leader_user_id, role: org.role }, members: members.rows, bucket });
  } catch (err) {
    logger.error({ err }, 'GET /api/orgs/mine failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orgs/usage — leader: every member's 30-day usage; member: own row.
router.get('/usage', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const { org } = found;
    const rows = await getOrgUsage(org.id);
    const data = org.role === 'leader' ? rows : rows.filter((r) => r.id === req.user.id);
    res.json({ success: true, usage: data });
  } catch (err) {
    logger.error({ err }, 'GET /api/orgs/usage failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orgs/members — leader adds a REGISTERED user by email.
// (Leaders cannot create accounts — the user must self-register first.)
router.post('/members', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id, true);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'No registered user with that email' });
    }
    try {
      await addMember(found.org.id, user.rows[0].id, 'member');
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    res.status(201).json({ success: true, added: user.rows[0].id });
  } catch (err) {
    logger.error({ err }, 'POST /api/orgs/members failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orgs/members/:userId — leader removes a member (not self;
// leaders use leave/transfer).
router.delete('/members/:userId', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id, true);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const target = parseInt(req.params.userId, 10);
    if (!target || target === req.user.id) {
      return res.status(400).json({ error: 'Invalid member (leaders use leave/transfer)' });
    }
    await removeMember(found.org.id, target);
    res.json({ success: true, removed: target });
  } catch (err) {
    logger.error({ err }, 'DELETE /api/orgs/members failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orgs/transfer — leader hands leadership to an active member.
router.post('/transfer', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id, true);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const target = parseInt(req.body.user_id, 10);
    if (!target || target === req.user.id) {
      return res.status(400).json({ error: 'Valid successor member required' });
    }
    const mem = await pool.query(
      `SELECT user_id FROM org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
      [found.org.id, target]
    );
    if (mem.rows.length === 0) {
      return res.status(404).json({ error: 'Successor is not an active member' });
    }
    await pool.query(`UPDATE orgs SET leader_user_id = $1 WHERE id = $2`, [target, found.org.id]);
    await pool.query(`UPDATE org_members SET role = 'member' WHERE org_id = $1 AND user_id = $2`, [found.org.id, req.user.id]);
    await pool.query(`UPDATE org_members SET role = 'leader' WHERE org_id = $1 AND user_id = $2`, [found.org.id, target]);
    res.json({ success: true, leader: target });
  } catch (err) {
    logger.error({ err }, 'POST /api/orgs/transfer failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orgs/leave — leave my org. A leaving leader promotes the
// oldest active member; the last member out disbands the org.
router.post('/leave', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const { org } = found;
    await removeMember(org.id, req.user.id);
    if (org.role === 'leader') {
      const next = await pool.query(
        `SELECT user_id FROM org_members WHERE org_id = $1 AND status = 'active' ORDER BY joined_at ASC LIMIT 1`,
        [org.id]
      );
      if (next.rows.length > 0) {
        const nid = next.rows[0].user_id;
        await pool.query(`UPDATE orgs SET leader_user_id = $1 WHERE id = $2`, [nid, org.id]);
        await pool.query(`UPDATE org_members SET role = 'leader' WHERE org_id = $1 AND user_id = $2`, [org.id, nid]);
      } else {
        await pool.query(`UPDATE orgs SET status = 'disbanded' WHERE id = $1`, [org.id]);
      }
    }
    res.json({ success: true, left: true });
  } catch (err) {
    logger.error({ err }, 'POST /api/orgs/leave failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
