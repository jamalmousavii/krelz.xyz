const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../logger');

// GET /api/leaderboard/mine — own rank among miners (authenticated)
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `WITH ranked AS (
         SELECT m.user_id, m.id, m.gpu_model, m.wallet_address, m.current_model,
                m.total_tasks, m.earnings,
                RANK() OVER (ORDER BY m.earnings DESC) AS rank,
                COUNT(*) OVER () AS total
         FROM miners m
         WHERE m.total_tasks > 0
       )
       SELECT rank, total, id, gpu_model, wallet_address, current_model, total_tasks, earnings
       FROM ranked
       WHERE user_id = $1
       ORDER BY rank ASC
       LIMIT 1`,
      [req.user.id]
    );

    const row = result.rows[0] || null;

    if (!row) {
      const any = await pool.query(
        `SELECT COUNT(*)::int AS n FROM miners
         WHERE user_id = $1 AND (status IS NULL OR status != 'removed')`,
        [req.user.id]
      );
      if (Number(any.rows[0].n) === 0) {
        return res.json({ success: true, isMiner: false, rank: null });
      }
      const total = await pool.query(
        `SELECT COUNT(*)::int AS n FROM miners WHERE total_tasks > 0`
      );
      return res.json({
        success: true, isMiner: true, rank: null,
        total: Number(total.rows[0].n), miner: null
      });
    }

    res.json({
      success: true,
      isMiner: true,
      rank: Number(row.rank),
      total: Number(row.total),
      miner: {
        id: row.id,
        gpu_model: row.gpu_model,
        wallet_address: row.wallet_address,
        current_model: row.current_model,
        total_tasks: row.total_tasks,
        earnings: row.earnings
      }
    });
  } catch (err) {
    logger.error({ err }, 'Leaderboard mine route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

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
    logger.error({ err }, 'Leaderboard route failed');
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
    logger.error({ err }, 'Leaderboard route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
