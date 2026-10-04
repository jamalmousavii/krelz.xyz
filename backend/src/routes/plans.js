const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate, optionalAuth } = require('../middleware/auth');
const nowpayments = require('../services/nowpayments');
const {
  FREE_DAILY_TOKENS,
  PLANS,
  TOKEN_BUNDLE,
  listPlans,
  quoteTokens,
  getActivePlan,
} = require('../services/plans');
const { getFreeStatus } = require('../services/freeAllowance');
const { getTokenBalance } = require('../services/tokenBundles');
const { logger } = require('../logger');

// Auth is optional on the snapshot: pricing/caps are public, the personal
// allowance block only appears with a valid token. Uses the shared middleware
// optionalAuth (v3.29.1) — an expired/garbage Bearer degrades to anonymous
// instead of 401ing the public catalog.

// GET /api/plans — plan catalog + token-bundle quote + public pricing.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const plan = userId ? await getActivePlan(userId) : null;
    const cap = plan ? PLANS[plan.plan_type].daily_tokens : FREE_DAILY_TOKENS;

    const body = {
      success: true,
      plans: listPlans(),
      plan: plan
        ? { name: plan.plan_type, active: true, expires_at: plan.expires_at }
        : { name: 'free', active: false, expires_at: null },
      daily_limit: cap,
      token_bundle: {
        price_per_million: TOKEN_BUNDLE.price_per_million,
        tokens_per_usd: TOKEN_BUNDLE.tokens_per_usd,
        min_usd: TOKEN_BUNDLE.min_usd,
        max_usd: TOKEN_BUNDLE.max_usd,
      },
    };
    if (userId) {
      const freeStatus = await getFreeStatus({ userId, cap });
      body.free_tokens = {
        limit: freeStatus.limit,
        used: freeStatus.used,
        remaining: freeStatus.remaining,
      };
      body.token_balance = await getTokenBalance(userId);
    }
    res.json(body);
  } catch (err) {
    logger.error({ err }, 'GET /api/plans failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans/tokens/purchase — prepaid token pot, whole dollars.
// Defined before /:tier/purchase so 'tokens' can never be read as a tier.
router.post('/tokens/purchase', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const amountUsd = Number(req.body?.amount_usd);

    if (!Number.isInteger(amountUsd)) {
      return res.status(400).json({ error: 'amount_usd must be a whole dollar amount' });
    }
    const minUsd = Math.max(TOKEN_BUNDLE.min_usd, nowpayments.getMinUsdDeposit());
    if (amountUsd < minUsd || amountUsd > TOKEN_BUNDLE.max_usd) {
      return res
        .status(400)
        .json({ error: `amount_usd must be between $${minUsd} and $${TOKEN_BUNDLE.max_usd}` });
    }

    const tokens = quoteTokens(amountUsd);
    const orderId = `tok-${userId}-${Date.now()}`;
    const result = await nowpayments.createInvoice({
      userId,
      amount: amountUsd,
      orderId,
      description: `Krelz token bundle - ${tokens.toLocaleString('en-US')} tokens (never expires)`,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Invoice creation failed' });
    }

    await pool.query(
      `INSERT INTO plan_purchases (order_id, user_id, invoice_id, amount, plan_type, tokens, status)
       VALUES ($1, $2, $3, $4, 'tokens', $5, 'pending')`,
      [orderId, userId, result.invoiceId ? String(result.invoiceId) : null, amountUsd, tokens]
    );

    res.status(201).json({
      success: true,
      invoice: {
        id: result.invoiceId,
        url: result.invoiceUrl,
        order_id: orderId,
        amountUsd,
        tokens,
      },
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/plans/tokens/purchase failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans/:tier/purchase — create the monthly plan invoice.
// Activation happens in the IPN webhook (plan_purchases claim keeps it
// exactly-once even if NowPayments replays the 'finished' notification).
router.post('/:tier/purchase', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const tier = String(req.params.tier).toLowerCase();
    const plan = PLANS[tier];
    if (!plan) {
      return res.status(400).json({ error: 'Unknown plan tier', code: 'INVALID_PLAN' });
    }

    const orderId = `${tier}-${userId}-${Date.now()}`;
    const result = await nowpayments.createInvoice({
      userId,
      amount: plan.price,
      orderId,
      description: `Krelz ${plan.label} plan - ${plan.interval_days} days (${plan.daily_tokens.toLocaleString('en-US')} tokens/day)`,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Invoice creation failed' });
    }

    await pool.query(
      `INSERT INTO plan_purchases (order_id, user_id, invoice_id, amount, plan_type, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [orderId, userId, result.invoiceId ? String(result.invoiceId) : null, plan.price, tier]
    );

    res.status(201).json({
      success: true,
      invoice: {
        id: result.invoiceId,
        url: result.invoiceUrl,
        order_id: orderId,
        amountUsd: plan.price,
        plan: tier,
      },
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/plans/:tier/purchase failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
