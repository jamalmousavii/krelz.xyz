const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { logger } = require('../logger');

// GET /api/token/balance — USD balance snapshot for the signed-in user.
// Auth is enforced by `authenticate` mounted in server.js, so req.user is set.
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.id;

    const balanceResult = await pool.query(
      `SELECT COALESCE(available, 0) as available, COALESCE(total_earned, 0) as total_earned, COALESCE(total_spent, 0) as total_spent
       FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'`,
      [userId]
    );

    const balance = balanceResult.rows[0] || { available: 0, total_earned: 0, total_spent: 0 };

    res.json({
      success: true,
      available: parseFloat(balance.available),
      total_earned: parseFloat(balance.total_earned),
      total_spent: parseFloat(balance.total_spent)
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
