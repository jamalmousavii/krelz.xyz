const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const nowpayments = require('../services/nowpayments');
const {
  FREE_DAILY_TOKENS,
  PLUS_DAILY_TOKENS,
  PLUS_PRICE_USD,
  PLUS_INTERVAL_DAYS,
  getActivePlan,
} = require('../services/plans');
const { getFreeStatus } = require('../services/freeAllowance');
const { logger } = require('../logger');

// Auth is optional on the snapshot: pricing/caps are public, the personal
// allowance block only appears with a valid token.
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) return authenticate(req, res, next);
  next();
};

// GET /api/plans — plan snapshot + public pricing.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const plan = userId ? await getActivePlan(userId) : null;
    const cap = plan ? PLUS_DAILY_TOKENS : FREE_DAILY_TOKENS;
    const body = {
      success: true,
      plan: plan
        ? { name: 'plus', active: true, expires_at: plan.expires_at }
        : { name: 'free', active: false, expires_at: null },
      daily_limit: cap,
      plus: {
        price: PLUS_PRICE_USD,
        daily_tokens: PLUS_DAILY_TOKENS,
        interval_days: PLUS_INTERVAL_DAYS,
      },
    };
    if (userId) {
      const freeStatus = await getFreeStatus({ userId, cap });
      body.free_tokens = {
        limit: freeStatus.limit,
        used: freeStatus.used,
        remaining: freeStatus.remaining,
      };
    }
    res.json(body);
  } catch (err) {
    logger.error({ err }, 'GET /api/plans failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans/plus/purchase — create the monthly Plus invoice.
// Activation happens in the IPN webhook (plan_purchases claim keeps it
// exactly-once even if NowPayments replays the 'finished' notification).
router.post('/plus/purchase', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = `plus-${userId}-${Date.now()}`;

    const result = await nowpayments.createInvoice({
      userId,
      amount: PLUS_PRICE_USD,
      orderId,
      description: `Krelz Plus plan - ${PLUS_INTERVAL_DAYS} days (${PLUS_DAILY_TOKENS.toLocaleString('en-US')} tokens/day)`,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Invoice creation failed' });
    }

    await pool.query(
      `INSERT INTO plan_purchases (order_id, user_id, invoice_id, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [orderId, userId, result.invoiceId ? String(result.invoiceId) : null, PLUS_PRICE_USD]
    );

    res.status(201).json({
      success: true,
      invoice: {
        id: result.invoiceId,
        url: result.invoiceUrl,
        order_id: orderId,
        amountUsd: PLUS_PRICE_USD,
      },
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/plans/plus/purchase failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
