const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { logger } = require('../logger');

const DAILY_TOKEN_LIMIT = 1000;

// GET /api/token/balance — USD/daily-token snapshot for the signed-in user.
// Auth is enforced by `authenticate` mounted in server.js, so req.user is set.
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.id;

    const balanceResult = await pool.query(
      `SELECT COALESCE(available, 0) as available, COALESCE(total_earned, 0) as total_earned, COALESCE(total_spent, 0) as total_spent
       FROM user_balances WHERE user_id = $1`,
      [userId]
    );

    const balance = balanceResult.rows[0] || { available: 0, total_earned: 0, total_spent: 0 };

    const today = new Date().toISOString().split('T')[0];
    let dailyUsed = 0;
    let dailyRemaining = DAILY_TOKEN_LIMIT;

    const dailyResult = await pool.query(
      'SELECT tokens_used_today, last_reset_date FROM daily_tokens WHERE user_id = $1',
      [userId]
    );

    if (dailyResult.rows.length > 0) {
      const { tokens_used_today, last_reset_date } = dailyResult.rows[0];
      const lastReset = last_reset_date instanceof Date
        ? last_reset_date.toISOString().split('T')[0]
        : String(last_reset_date).slice(0, 10);
      if (lastReset === today) {
        dailyUsed = parseFloat(tokens_used_today);
        dailyRemaining = Math.max(0, DAILY_TOKEN_LIMIT - dailyUsed);
      }
    }

    res.json({
      success: true,
      available: parseFloat(balance.available),
      total_earned: parseFloat(balance.total_earned),
      total_spent: parseFloat(balance.total_spent),
      daily_tokens: {
        limit: DAILY_TOKEN_LIMIT,
        used: dailyUsed,
        remaining: dailyRemaining
      }
    });

  } catch (err) {
    logger.error({ err }, 'GET /api/token/balance failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy self-service ledger endpoints. They let any signed-in user mint an
// arbitrary balance (deposit self-confirms without any chain verification) or
// move funds without any economic check, and nothing in the app calls them:
// balances are funded exclusively through NowPayments (/api/payments).
const gone = (name) => (req, res) => {
  res.status(410).json({
    error: `${name} is no longer supported. Fund your wallet with POST /api/payments/deposit/create.`,
  });
};

router.post('/deposit', gone('POST /api/token/deposit'));
router.post('/deduct', gone('POST /api/token/deduct'));
router.post('/transfer', gone('POST /api/token/transfer'));

module.exports = router;
