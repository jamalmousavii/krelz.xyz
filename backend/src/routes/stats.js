const express = require('express');
const router = express.Router();
const pool = require('../database/pool');

// GET /api/stats/network
router.get('/network', async (req, res) => {
  try {
    const minersResult = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as online FROM miners', ['online']);
    const usersResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const tasksResult = await pool.query('SELECT COUNT(*) as total FROM tasks');
    const burnedResult = await pool.query('SELECT COALESCE(SUM(cost * 0.01), 0) as total FROM tasks WHERE status = $1', ['completed']);
    
    res.json({
      success: true,
      stats: {
        total_miners: parseInt(minersResult.rows[0].total),
        active_miners: parseInt(minersResult.rows[0].online),
        total_users: parseInt(usersResult.rows[0].total),
        total_requests: parseInt(tasksResult.rows[0].total),
        total_tokens_burned: parseFloat(burnedResult.rows[0].total)
      }
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
