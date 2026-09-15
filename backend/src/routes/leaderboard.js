const express = require('express');
const router = express.Router();
const pool = require('../database/pool');

// GET /api/leaderboard/miners
router.get('/miners', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, wallet_address, gpu_model, total_tasks, earnings, status, current_model
       FROM miners
       WHERE total_tasks > 0
       ORDER BY earnings DESC
       LIMIT 50`
    );
    res.json({ success: true, miners: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.avatar, COALESCE(b.total_earned, 0) as earned, COALESCE(b.total_spent, 0) as spent
       FROM users u
       LEFT JOIN user_balances b ON u.id = b.user_id
       WHERE COALESCE(b.total_earned, 0) > 0
       ORDER BY b.total_earned DESC
       LIMIT 50`
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
