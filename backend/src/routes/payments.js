const express = require('express');
const router = express.Router();
const pool = require('../database/pool');

// POST /api/payments/create
router.post('/create', async (req, res) => {
  try {
    const { amount, from_address, to_address, type, description } = req.body;

    const result = await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, status, description)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [from_address, to_address, amount, type, description]
    );

    res.status(201).json({
      success: true,
      transaction: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      'SELECT * FROM transactions WHERE from_address = $1 OR to_address = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    res.json({
      success: true,
      transactions: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/stats
router.get('/stats', async (req, res) => {
  try {
    const totalResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'completed'");
    const depositsResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'deposit' AND status = 'completed'");
    const earningsResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'miner_earning' AND status = 'completed'");
    const platformFees = await pool.query("SELECT COALESCE(SUM(cost * 0.1), 0) as total FROM tasks WHERE status = 'completed'");

    res.json({
      success: true,
      stats: {
        total_volume: parseFloat(totalResult.rows[0].total),
        total_deposits: parseFloat(depositsResult.rows[0].total),
        total_miner_earnings: parseFloat(earningsResult.rows[0].total),
        total_platform_fees: parseFloat(platformFees.rows[0].total)
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
