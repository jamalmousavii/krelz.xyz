const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { invalidateCache } = require('../cache');
const { authenticate } = require('../middleware/auth');

// GET /api/miners
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, wallet_address, gpu_model, ram, cpu, status, uptime, total_tasks, earnings FROM miners ORDER BY earnings DESC'
    );

    res.json({
      success: true,
      miners: result.rows
    });
    invalidateCache('/api/stats');
    invalidateCache('/api/miners');

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/miners/mine — get current user's miner
router.get('/mine', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, wallet_address, gpu_model, ram, cpu, models, current_model,
              status, uptime, total_tasks, earnings, created_at
       FROM miners WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      miner: result.rows[0] || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/miners/mine/model — switch current model
router.put('/mine/model', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    const result = await pool.query(
      `UPDATE miners SET current_model = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 RETURNING id, current_model`,
      [model, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    res.json({ success: true, miner: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/miners/register
router.post('/register', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { wallet_address, gpu_model, ram, cpu, models } = req.body;

    const minerExists = await pool.query('SELECT id FROM miners WHERE user_id = $1', [userId]);
    if (minerExists.rows.length > 0) {
      return res.status(400).json({ error: 'Miner already registered' });
    }

    const result = await pool.query(
      'INSERT INTO miners (user_id, wallet_address, gpu_model, ram, cpu, models) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userId, wallet_address || '', gpu_model, ram, cpu, JSON.stringify(models || ['llama3.1:8b'])]
    );

    res.status(201).json({
      success: true,
      miner: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/miners/:id/heartbeat
router.put('/:id/heartbeat', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, gpu_usage, ram_usage, tasks_completed, current_model } = req.body;

    const result = await pool.query(
      `UPDATE miners
       SET status = $1,
           uptime = CASE WHEN $1 = 'online' THEN LEAST(uptime + 0.1, 100) ELSE uptime END,
           total_tasks = total_tasks + $2,
           current_model = COALESCE($4, current_model),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, tasks_completed || 0, id, current_model]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    res.json({
      success: true,
      miner: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/miners/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, wallet_address, gpu_model, ram, cpu, status, uptime, total_tasks, earnings FROM miners WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    res.json({
      success: true,
      miner: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
