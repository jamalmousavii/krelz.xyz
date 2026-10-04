const pool = require('../database/pool');
const { logger } = require('../logger');
const { activatePlan, PLANS } = require('./plans');
const { creditTokens } = require('./tokenBundles');
const { invalidateCache } = require('../cache');

// Exactly-once claim helpers (B4). Both the IPN webhook and the nightly
// reconciler apply money through these — the UPDATE-while-pending claim is
// what makes replays and concurrent deliveries safe, so it must stay in ONE
// place. Each returns { deduped } and never credits twice.

// plan_purchases: plan tiers (plus/pro/max) activate the subscription,
// 'tok' credits the prepaid token pot. Order ids: "<tier>-<userId>-<ts>".
async function applyPlanPurchase({ userId, orderId, txHash = null }) {
  const orderPrefix = (orderId || '').split('-')[0];
  if (!orderId || !(orderPrefix === 'tok' || PLANS[orderPrefix])) {
    return { deduped: true };
  }

  const client = await pool.connect();
  let appliedType = orderPrefix;
  try {
    await client.query('BEGIN');
    const claim = await client.query(
      `UPDATE plan_purchases
          SET status = 'completed', tx_hash = COALESCE($1, tx_hash)
        WHERE order_id = $2 AND user_id = $3 AND status = 'pending'
        RETURNING plan_type, tokens`,
      [txHash, orderId, userId]
    );

    if (claim.rows.length === 0) {
      await client.query('COMMIT');
      logger.warn({ userId, orderId }, 'Claim skipped (purchase already processed)');
      return { deduped: true };
    }

    appliedType = claim.rows[0].plan_type || orderPrefix;
    if (appliedType === 'tokens') {
      await creditTokens(userId, claim.rows[0].tokens, client);
    } else {
      await activatePlan(userId, appliedType, client);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  invalidateCache('/api/payments/balance');
  logger.info({ userId, orderId, planType: appliedType }, 'Plan/token purchase applied');
  return { deduped: false, planType: appliedType };
}

// coin_deposits: USD wallet deposits. Credits the amount stored when the
// invoice was created — never an amount asserted by the caller (webhook or
// reconciler).
async function applyDeposit({ userId, orderId, invoiceId, txHash = null, cryptoCoin = null }) {
  const client = await pool.connect();
  let credited = false;
  let storedAmount = 0;
  try {
    await client.query('BEGIN');

    const claim = await client.query(
      `UPDATE coin_deposits
          SET status = 'completed', tx_hash = COALESCE($1, tx_hash)
        WHERE user_id = $2
          AND status = 'pending'
          AND (order_id = $3 OR processor_id = $3 OR processor_id = $4)
        RETURNING id, amount`,
      [txHash, userId, orderId, invoiceId]
    );

    if (claim.rows.length === 0) {
      await client.query('COMMIT');
      logger.warn({ userId, orderId }, 'Claim skipped (deposit already processed)');
      return { deduped: true };
    }

    storedAmount = parseFloat(claim.rows[0].amount);

    await client.query(
      `INSERT INTO user_coin_balances (user_id, coin, chain, available, total_earned)
       VALUES ($1, 'USD', 'usd', $2, $2)
       ON CONFLICT (user_id, coin) DO UPDATE SET
       available = user_coin_balances.available + $2,
       total_earned = user_coin_balances.total_earned + $2`,
      [userId, storedAmount]
    );

    await client.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, description, status)
       VALUES ('deposit', $1, $2, 'usd_deposit', $3, 'completed')`,
      [userId, storedAmount, `USD deposit via NowPayments (${cryptoCoin || 'crypto'} paid)`]
    );

    await client.query('COMMIT');
    credited = true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (credited) {
    invalidateCache('/api/payments/balance');
    logger.info({ userId, amount: storedAmount, orderId }, 'Deposit confirmed');
  }
  return { deduped: false, amount: storedAmount };
}

module.exports = { applyPlanPurchase, applyDeposit };
