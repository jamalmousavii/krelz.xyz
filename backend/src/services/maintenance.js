const pool = require('../database/pool');
const nowpayments = require('./nowpayments');
const { applyPlanPurchase, applyDeposit } = require('./paymentClaims');
const { logger } = require('../logger');

const RECONCILE_BATCH = 25;
const RECONCILE_MINUTES = 30;
const MEDIA_RETENTION_DAYS = parseInt(process.env.MEDIA_RETENTION_DAYS || '7', 10);

// B4: IPN delivery is not guaranteed (NowPayments outage, webhook 5xx,
// nginx restart mid-flight). Re-check stale pending purchases against the
// NowPayments API and apply them through the SAME exactly-once claim helpers
// the webhook uses — a late IPN racing the reconciler still credits once.
// Only 'finished' invoices are applied; expired rows are left pending (an
// expired invoice can never reach 'finished', and marking failed rows risks
// breaking a live invoice whose invoice_id we failed to store).
async function reconcilePendingPayments() {
  const stalePurchases = await pool.query(
    `SELECT order_id, user_id, invoice_id
       FROM plan_purchases
      WHERE status = 'pending'
        AND invoice_id IS NOT NULL
        AND created_at < NOW() - make_interval(mins => $1)
      ORDER BY created_at ASC
      LIMIT $2`,
    [RECONCILE_MINUTES, RECONCILE_BATCH]
  );

  for (const row of stalePurchases.rows) {
    try {
      const invoice = await nowpayments.getPaymentStatus(row.invoice_id);
      if (!invoice.success || invoice.status?.payment_status !== 'finished') continue;
      const outcome = await applyPlanPurchase({ userId: row.user_id, orderId: row.order_id });
      logger.info({ orderId: row.order_id, deduped: outcome.deduped }, 'Reconciled plan purchase');
    } catch (err) {
      logger.error({ err, orderId: row.order_id }, 'Plan purchase reconciliation failed');
    }
  }

  const staleDeposits = await pool.query(
    `SELECT order_id, user_id, processor_id
       FROM coin_deposits
      WHERE status = 'pending'
        AND created_at < NOW() - make_interval(mins => $1)
      ORDER BY created_at ASC
      LIMIT $2`,
    [RECONCILE_MINUTES, RECONCILE_BATCH]
  );

  for (const row of staleDeposits.rows) {
    try {
      const invoice = await nowpayments.getPaymentStatus(row.processor_id);
      if (!invoice.success || invoice.status?.payment_status !== 'finished') continue;
      const outcome = await applyDeposit({
        userId: row.user_id,
        orderId: row.order_id,
        invoiceId: row.processor_id,
      });
      logger.info({ orderId: row.order_id, deduped: outcome.deduped }, 'Reconciled deposit');
    } catch (err) {
      logger.error({ err, orderId: row.order_id }, 'Deposit reconciliation failed');
    }
  }
}

// B11: tasks.media holds base64 payloads that were never pruned — every
// GET /sessions/:id re-selects them, so one old screenshot inflates every
// future session fetch (and the table) forever. Strip media past the
// retention window; messages keep their text.
async function pruneOldMedia() {
  const result = await pool.query(
    `UPDATE tasks
        SET media = NULL
      WHERE media IS NOT NULL
        AND created_at < NOW() - make_interval(days => $1)`,
    [MEDIA_RETENTION_DAYS]
  );
  if (result.rowCount > 0) {
    logger.info({ count: result.rowCount, days: MEDIA_RETENTION_DAYS }, 'Pruned old task media');
  }
}

// Idempotent by construction: claims are exactly-once and NULL-ing old media
// is safe to repeat, so restarts/overlapping runs are harmless.
async function runMaintenance() {
  try {
    await reconcilePendingPayments();
  } catch (err) {
    logger.error({ err }, 'Payment reconciliation run failed');
  }
  try {
    await pruneOldMedia();
  } catch (err) {
    logger.error({ err }, 'Media prune run failed');
  }
}

module.exports = { runMaintenance, reconcilePendingPayments, pruneOldMedia };
