const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { logger } = require('../logger');

// Platform keeps 10% of every paid task (miners get 90%) — single definition
// shared with routes/admin.js. There is no burn mechanism in the codebase.
const PLATFORM_REVENUE_SHARE = 0.1;

// GET /api/stats/network — powers the public explorer page: summary stats
// plus the rows its transactions/miners tabs render.
router.get('/network', async (req, res) => {
  try {
    const minersResult = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'online') AS online
         FROM miners
        WHERE status IS NULL OR status != 'removed'`
    );

    const totalsResult = await pool.query(`
      SELECT (SELECT COUNT(*) FROM users) AS total_users,
             (SELECT COUNT(*) FROM tasks) AS total_requests,
             (SELECT COUNT(*) FROM tasks WHERE status = 'completed') AS completed_tasks,
             COALESCE(SUM(cost) FILTER (WHERE status = 'completed'), 0) AS total_cost,
             COALESCE(SUM(cost * ${PLATFORM_REVENUE_SHARE}) FILTER (WHERE status = 'completed'), 0) AS platform_revenue
        FROM tasks
    `);

    const totals = totalsResult.rows[0];

    const tasksResult = await pool.query(`
      SELECT id, user_id, miner_id, tokens_used, cost, status, created_at
        FROM tasks
       ORDER BY id DESC
       LIMIT 50
    `);

    const topMinersResult = await pool.query(`
      SELECT id, gpu_model, wallet_address, status, total_tasks, earnings
        FROM miners
       WHERE status IS NULL OR status != 'removed'
       ORDER BY COALESCE(total_tasks, 0) DESC, id ASC
       LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        total_miners: parseInt(minersResult.rows[0].total, 10),
        active_miners: parseInt(minersResult.rows[0].online, 10),
        total_users: parseInt(totals.total_users, 10),
        total_requests: parseInt(totals.total_requests, 10),
        completed_tasks: parseInt(totals.completed_tasks, 10),
        total_cost: parseFloat(totals.total_cost),
        platform_revenue: parseFloat(totals.platform_revenue),
      },
      recent_tasks: tasksResult.rows,
      top_miners: topMinersResult.rows,
    });

  } catch (err) {
    logger.error({ err }, 'GET /api/stats/network failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
