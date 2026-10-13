const pool = require('../database/pool');
const { getDailyCap, getActivePlan, FREE_DAILY_TOKENS } = require('./plans');

// Organization plans (v3.44.0): an org shares its LEADER's plan cap as one
// bucket (the leader's daily_tokens row, same row-locked pattern). Per-member
// attribution comes from tasks — no separate usage tracking.
async function getActiveOrg(userId, client = pool) {
  if (!userId) return null;
  const r = await client.query(
    `SELECT o.id, o.name, o.leader_user_id, m.role
       FROM org_members m JOIN orgs o ON o.id = m.org_id
      WHERE m.user_id = $1 AND m.status = 'active' AND o.status = 'active'`,
    [userId]
  );
  return r.rows[0] || null;
}

// Effective daily cap + whose bucket row to charge: max(own, org-leader).
// Returns { cap, bucketUserId, org } — bucketUserId is null only for guests.
async function resolveCap(userId, guestKey, client = pool) {
  const ownCap = await getDailyCap(userId, client);
  if (!userId) return { cap: ownCap, bucketUserId: null, org: null };
  const org = await getActiveOrg(userId, client);
  if (!org) return { cap: ownCap, bucketUserId: userId, org: null };
  const leaderPlan = await getActivePlan(org.leader_user_id, client);
  if (!leaderPlan) return { cap: ownCap, bucketUserId: userId, org };
  const { PLANS } = require('./plans');
  const leaderCap = PLANS[leaderPlan.plan_type]
    ? PLANS[leaderPlan.plan_type].daily_tokens
    : FREE_DAILY_TOKENS;
  if (leaderCap > ownCap) {
    return { cap: leaderCap, bucketUserId: org.leader_user_id, org };
  }
  return { cap: ownCap, bucketUserId: userId, org };
}

async function getOrgUsage(orgId, client = pool) {
  const members = await client.query(
    `SELECT u.id, u.email, m.role, m.joined_at,
            COALESCE(SUM(t.tokens_used), 0)::float AS tokens,
            COUNT(t.id)::int AS messages,
            COALESCE(SUM(t.cost), 0)::float AS cost
       FROM org_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN tasks t ON t.user_id = u.id
         AND t.created_at > now() - interval '30 days'
      WHERE m.org_id = $1 AND m.status = 'active'
      GROUP BY u.id, u.email, m.role, m.joined_at
      ORDER BY tokens DESC`,
    [orgId]
  );
  return members.rows;
}

async function addMember(orgId, userId, role = 'member', client = pool) {
  const existing = await client.query(
    `SELECT org_id FROM org_members WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
  if (existing.rows.length > 0) {
    throw new Error('User already belongs to an active org');
  }
  await client.query(
    `INSERT INTO org_members (org_id, user_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active', role = $3`,
    [orgId, userId, role]
  );
}

async function removeMember(orgId, userId, client = pool) {
  await client.query(
    `UPDATE org_members SET status = 'removed' WHERE org_id = $1 AND user_id = $2`,
    [orgId, userId]
  );
}

module.exports = {
  getActiveOrg,
  resolveCap,
  getOrgUsage,
  addMember,
  removeMember,
};
