const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { logger } = require('../logger');

// Platform keeps 10% of every paid task (miners get 90%) — single definition
// shared with routes/admin.js. There is no burn mechanism in the codebase.
const PLATFORM_REVENUE_SHARE = 0.1;

// GET /api/stats/network
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
             COALESCE(SUM(cost) FILTER (WHERE status = 'completed'), 0) AS total_cost,
             COALESCE(SUM(cost * ${PLATFORM_REVENUE_SHARE}) FILTER (WHERE status = 'completed'), 0) AS platform_revenue
        FROM tasks
    `);

    const totals = totalsResult.rows[0];

    res.json({
      success: true,
      stats: {
        total_miners: parseInt(minersResult.rows[0].total, 10),
        active_miners: parseInt(minersResult.rows[0].online, 10),
        total_users: parseInt(totals.total_users, 10),
        total_requests: parseInt(totals.total_requests, 10),
        total_cost: parseFloat(totals.total_cost),
        platform_revenue: parseFloat(totals.platform_revenue),
      }
    });

  } catch (err) {
    logger.error({ err }, 'GET /api/stats/network failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
