const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const { getActiveOrg, getOrgUsage, addMember, removeMember } = require('../services/org');
const { getFreeStatus } = require('../services/freeAllowance');
const { getDailyCap } = require('../services/plans');
const { makeLimiter } = require('../middleware/rateLimit');
const { withTransaction } = require('../database/tx');
const { logger } = require('../logger');

// All routes are JWT-authenticated. Orgs are created by admins
// (/api/admin/orgs); leaders manage members by registered email.
router.use(authenticate);

// v3.45.0 — add-by-email inherently lets a leader check whether an address is
// registered, so the control is a tight per-leader budget (plus the global
// /api/ limiter) instead of a bigger response surface.
const addMemberLimiter = makeLimiter({
  name: 'org-member-add',
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u:${req.user?.id || req.ip}`,
  message: { error: 'Too many member additions, try again later.' },
});

function fail(res, err, msg) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  logger.error({ err }, msg);
  res.status(500).json({ error: 'Server error' });
}

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
router.post('/members', addMemberLimiter, async (req, res) => {
  try {
    const found = await requireOrg(req.user.id, true);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    // Lookup + insert in ONE transaction (v3.45.0): the membership unique
    // index is the race guard and the org can't vanish between statements.
    const added = await withTransaction(async (client) => {
      const orgNow = await client.query('SELECT status FROM orgs WHERE id = $1', [found.org.id]);
      if (orgNow.rows.length === 0 || orgNow.rows[0].status !== 'active') {
        throw Object.assign(new Error('Org is no longer active'), { status: 404 });
      }
      const user = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (user.rows.length === 0) {
        throw Object.assign(new Error('No registered user with that email'), { status: 404 });
      }
      await addMember(found.org.id, user.rows[0].id, 'member', client);
      return user.rows[0].id;
    });
    res.status(201).json({ success: true, added });
  } catch (err) {
    fail(res, err, 'POST /api/orgs/members failed');
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
    const removed = await removeMember(found.org.id, target);
    if (removed === 0) return res.status(404).json({ error: 'Member not found' });
    res.json({ success: true, removed: target });
  } catch (err) {
    logger.error({ err }, 'DELETE /api/orgs/members failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orgs/transfer — leader hands leadership to an active member.
// One transaction, org row locked: concurrent transfer/leave serialize.
router.post('/transfer', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id, true);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const target = parseInt(req.body.user_id, 10);
    if (!target || target === req.user.id) {
      return res.status(400).json({ error: 'Valid successor member required' });
    }
    await withTransaction(async (client) => {
      const orgRow = await client.query(
        'SELECT leader_user_id, status FROM orgs WHERE id = $1 FOR UPDATE',
        [found.org.id]
      );
      if (orgRow.rows.length === 0 || orgRow.rows[0].status !== 'active') {
        throw Object.assign(new Error('Org is no longer active'), { status: 404 });
      }
      if (orgRow.rows[0].leader_user_id !== req.user.id) {
        throw Object.assign(new Error('Org leader only'), { status: 403 });
      }
      const mem = await client.query(
        `SELECT user_id FROM org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
        [found.org.id, target]
      );
      if (mem.rows.length === 0) {
        throw Object.assign(new Error('Successor is not an active member'), { status: 404 });
      }
      await client.query(`UPDATE orgs SET leader_user_id = $1 WHERE id = $2`, [target, found.org.id]);
      await client.query(`UPDATE org_members SET role = 'member' WHERE org_id = $1 AND user_id = $2`, [found.org.id, req.user.id]);
      await client.query(`UPDATE org_members SET role = 'leader' WHERE org_id = $1 AND user_id = $2`, [found.org.id, target]);
    });
    res.json({ success: true, leader: target });
  } catch (err) {
    fail(res, err, 'POST /api/orgs/transfer failed');
  }
});

// POST /api/orgs/leave — leave my org. A leaving leader promotes the
// oldest active member; the last member out disbands the org. One
// transaction, org row locked (v3.45.0).
router.post('/leave', async (req, res) => {
  try {
    const found = await requireOrg(req.user.id);
    if (found.error) return res.status(found.error.status).json(found.error.body);
    const { org } = found;
    await withTransaction(async (client) => {
      const orgRow = await client.query(
        'SELECT leader_user_id, status FROM orgs WHERE id = $1 FOR UPDATE',
        [org.id]
      );
      if (orgRow.rows.length === 0) return;
      if (orgRow.rows[0].status !== 'active') {
        // Disbanded concurrently — make sure my row is out, then stop.
        await removeMember(org.id, req.user.id, client);
        return;
      }
      const wasLeader = orgRow.rows[0].leader_user_id === req.user.id;
      await removeMember(org.id, req.user.id, client);
      if (wasLeader) {
        const next = await client.query(
          `SELECT user_id FROM org_members WHERE org_id = $1 AND status = 'active' ORDER BY joined_at ASC LIMIT 1`,
          [org.id]
        );
        if (next.rows.length > 0) {
          const nid = next.rows[0].user_id;
          await client.query(`UPDATE orgs SET leader_user_id = $1 WHERE id = $2`, [nid, org.id]);
          await client.query(`UPDATE org_members SET role = 'leader' WHERE org_id = $1 AND user_id = $2`, [org.id, nid]);
        } else {
          await client.query(`UPDATE orgs SET status = 'disbanded' WHERE id = $1`, [org.id]);
        }
      }
    });
    res.json({ success: true, left: true });
  } catch (err) {
    fail(res, err, 'POST /api/orgs/leave failed');
  }
});

module.exports = router;
