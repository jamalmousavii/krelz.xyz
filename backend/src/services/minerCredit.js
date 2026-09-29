// Free daily chat credit for users who run an online miner (v3.25.0).
//
// The allowance is platform-funded: spending it never debits the USD wallet
// and never credits a miner (no MINER_REVENUE_SHARE) — paid chats remain the
// only source of miner revenue, so the miner pool is untouched.
const pool = require('../database/pool');

const MINER_DAILY_CREDIT_USD = 1.0;

// 'busy' counts as online: the miner is up and actively serving.
const ELIGIBLE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM miners WHERE user_id = $1 AND status IN ('online', 'busy')
  ) AS eligible`;

// All dates are compared on the UTC calendar so the daily reset does not
// depend on the DB or Node timezone.
const UTC_TODAY = `(now() AT TIME ZONE 'utc')::date`;

async function hasOnlineMiner(userId, client = pool) {
  const r = await client.query(ELIGIBLE_SQL, [userId]);
  return !!r.rows[0]?.eligible;
}

// Read-only snapshot for pre-flight checks and balance endpoints. A stale
// row (from a previous UTC day) counts as fully unused without writing.
async function getMinerCreditStatus(userId, client = pool) {
  const eligible = await hasOnlineMiner(userId, client);
  if (!eligible) {
    return { eligible: false, limit: MINER_DAILY_CREDIT_USD, used: 0, remaining: 0 };
  }

  const r = await client.query(
    `SELECT CASE WHEN last_reset_date = ${UTC_TODAY}
                 THEN usd_used_today
                 ELSE 0 END AS used
       FROM miner_daily_credit
      WHERE user_id = $1`,
    [userId]
  );
  const used = parseFloat(r.rows[0]?.used || 0);
  return {
    eligible: true,
    limit: MINER_DAILY_CREDIT_USD,
    used,
    remaining: Math.max(0, MINER_DAILY_CREDIT_USD - used),
  };
}

// Charge `cost` (USD) inside the caller's payment transaction. The upsert
// row-locks the credit row and rolls a stale (pre-UTC-today) usage to zero in
// the same statement, so parallel requests can't overspend the allowance.
// Returns { charged: boolean, remaining: number|null }; remaining is null
// when the user is not eligible at all.
async function chargeMinerCredit(userId, cost, client) {
  const eligible = await hasOnlineMiner(userId, client);
  if (!eligible) return { charged: false, remaining: null };

  const r = await client.query(
    `INSERT INTO miner_daily_credit (user_id, usd_used_today, last_reset_date)
          VALUES ($1, 0, ${UTC_TODAY})
     ON CONFLICT (user_id) DO UPDATE
        SET usd_used_today = CASE
              WHEN miner_daily_credit.last_reset_date = ${UTC_TODAY} THEN miner_daily_credit.usd_used_today
              ELSE 0
            END,
            last_reset_date = ${UTC_TODAY}
     RETURNING usd_used_today`,
    [userId]
  );

  const used = parseFloat(r.rows[0]?.usd_used_today || 0);
  const remaining = Math.max(0, MINER_DAILY_CREDIT_USD - used);
  // Epsilon keeps float drift (repeated subtractions of ~1e-4) from denying
  // a charge that is covered for all practical purposes.
  if (remaining >= cost - 1e-9) {
    await client.query(
      'UPDATE miner_daily_credit SET usd_used_today = usd_used_today + $1 WHERE user_id = $2',
      [cost, userId]
    );
    return { charged: true, remaining: Math.max(0, remaining - cost) };
  }
  return { charged: false, remaining };
}

module.exports = {
  MINER_DAILY_CREDIT_USD,
  hasOnlineMiner,
  getMinerCreditStatus,
  chargeMinerCredit,
};
