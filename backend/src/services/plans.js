// Subscription plans (v3.27.0).
//
// Free: every subject (signed-in user or guest, tracked by IP) gets a daily
// token allowance. Plus: a paid monthly plan that raises that allowance.
// Marginal serving cost is ~0 (our own Ollama + miner network), so pricing
// follows market value, not token cost — the Plus revenue covers the fixed
// server cost that Free users consume.
const pool = require('../database/pool');

const FREE_DAILY_TOKENS = 2000000;
const PLUS_DAILY_TOKENS = 10000000;
const PLUS_PRICE_USD = 6.99;
const PLUS_INTERVAL_DAYS = 30;

// Active = status 'active' AND not expired. An expired row keeps existing
// (renewal extends from max(now, expires_at)) but no longer matches.
async function getActivePlan(userId, client = pool) {
  if (!userId) return null;
  const r = await client.query(
    `SELECT plan_type, expires_at FROM user_plans
      WHERE user_id = $1 AND status = 'active' AND expires_at > now()`,
    [userId]
  );
  return r.rows[0] || null;
}

// Daily cap for the subject: Plus members get the bigger allowance,
// everyone else (including guests) the Free one.
async function getDailyCap(userId, client = pool) {
  const plan = await getActivePlan(userId, client);
  return plan ? PLUS_DAILY_TOKENS : FREE_DAILY_TOKENS;
}

// Called exactly once per confirmed Plus invoice (claimed via plan_purchases
// before this runs), inside the caller's transaction.
async function activatePlus(userId, client = pool) {
  await client.query(
    `INSERT INTO user_plans (user_id, plan_type, status, started_at, expires_at)
          VALUES ($1, 'plus', 'active', now(), now() + ($2::int * interval '1 day'))
     ON CONFLICT (user_id, plan_type) DO UPDATE
        SET status = 'active',
            started_at = COALESCE(user_plans.started_at, now()),
            expires_at = GREATEST(COALESCE(user_plans.expires_at, now()), now())
                       + ($2::int * interval '1 day')`,
    [userId, PLUS_INTERVAL_DAYS]
  );
}

module.exports = {
  FREE_DAILY_TOKENS,
  PLUS_DAILY_TOKENS,
  PLUS_PRICE_USD,
  PLUS_INTERVAL_DAYS,
  getActivePlan,
  getDailyCap,
  activatePlus,
};
