const express = require('express');
const router = express.Router();
const crypto = require('crypto');
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
              status, uptime, total_tasks, earnings, created_at,
              gpu_usage, ram_usage, cpu_usage, disk_usage
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

// POST /api/miners/token — generate unique miner token for install script
router.post('/token', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has a miner token
    const existing = await pool.query('SELECT miner_token FROM users WHERE id = $1', [userId]);
    if (existing.rows[0]?.miner_token) {
      return res.json({ success: true, miner_token: existing.rows[0].miner_token });
    }

    // Generate new unique token
    const minerToken = 'kz_' + crypto.randomBytes(32).toString('hex');

    await pool.query('UPDATE users SET miner_token = $1 WHERE id = $2', [minerToken, userId]);

    res.json({ success: true, miner_token: minerToken });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/miners/setup — register miner via install script (email + token + system info)
router.post('/setup', async (req, res) => {
  try {
    const { email, miner_token, gpu_model, ram, cpu, models } = req.body;

    if (!email || !miner_token) {
      return res.status(400).json({ error: 'Email and miner token are required' });
    }

    // Verify user by email + miner_token
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND miner_token = $2',
      [email, miner_token]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or miner token' });
    }

    const userId = userResult.rows[0].id;

    // Check if miner already exists for this user
    const minerExists = await pool.query('SELECT id FROM miners WHERE user_id = $1', [userId]);
    if (minerExists.rows.length > 0) {
      // Update existing miner
      const result = await pool.query(
        `UPDATE miners SET gpu_model = $1, ram = $2, cpu = $3, models = $4, status = 'online', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $5 RETURNING *`,
        [gpu_model, ram, cpu, JSON.stringify(models || ['llama3.1:8b']), userId]
      );
      return res.json({ success: true, miner: result.rows[0] });
    }

    // Create new miner
    const result = await pool.query(
      'INSERT INTO miners (user_id, wallet_address, gpu_model, ram, cpu, models, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, '', gpu_model || '', ram || '', cpu || '', JSON.stringify(models || ['llama3.1:8b']), 'online']
    );

    res.status(201).json({ success: true, miner: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/miners/register — DISABLED (use /setup with email + token instead)
router.post('/register', authenticate, async (req, res) => {
  return res.status(403).json({ error: 'Manual registration disabled. Use /api/miners/setup with email and miner token.' });
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
