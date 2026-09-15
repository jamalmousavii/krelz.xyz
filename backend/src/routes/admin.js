const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/admin/dashboard
router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  try {
    const [miners, users, tasks, revenue] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'online' THEN 1 END) as online FROM miners`),
      pool.query('SELECT COUNT(*) as total FROM users'),
      pool.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM tasks`),
      pool.query("SELECT COALESCE(SUM(cost * 0.1), 0) as platform_fees FROM tasks WHERE status = 'completed'"),
    ]);

    res.json({
      success: true,
      dashboard: {
        miners: { total: parseInt(miners.rows[0].total), online: parseInt(miners.rows[0].online) },
        users: parseInt(users.rows[0].total),
        tasks: { total: parseInt(tasks.rows[0].total), completed: parseInt(tasks.rows[0].completed) },
        revenue: parseFloat(revenue.rows[0].platform_fees),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/miners
router.get('/miners', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM miners ORDER BY earnings DESC LIMIT 100'
    );
    res.json({ success: true, miners: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/tasks
router.get('/tasks', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT t.*, u.email as user_email FROM tasks t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 100'
    );
    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
