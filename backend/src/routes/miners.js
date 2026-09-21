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

// GET /api/miners/mine — get current user's miners (all, incl. offline)
router.get('/mine', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, wallet_address, gpu_model, ram, cpu, models, current_model,
              status, uptime, total_tasks, earnings, created_at,
              gpu_usage, ram_usage, cpu_usage, disk_usage,
              machine_id, name
       FROM miners WHERE user_id = $1 AND (status IS NULL OR status != 'removed')
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json({
      success: true,
      miners: result.rows,
      // Legacy: first miner (backward compat for old clients)
      miner: result.rows[0] || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/miners/mine/model — switch current model (miner_id required for multi-miner)
router.put('/mine/model', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { model, miner_id } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    let result;
    if (miner_id) {
      // Scoped: only the user's own miner
      result = await pool.query(
        `UPDATE miners SET current_model = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3 AND (status IS NULL OR status != 'removed')
         RETURNING id, current_model`,
        [model, miner_id, userId]
      );
    } else {
      // Legacy: first miner of the user
      result = await pool.query(
        `UPDATE miners SET current_model = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND (status IS NULL OR status != 'removed')
         RETURNING id, current_model`,
        [model, userId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    res.json({ success: true, miner: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/miners/mine/:id — rename a miner (own miners only)
router.put('/mine/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const minerId = parseInt(req.params.id);
    const { name } = req.body;

    if (!minerId) {
      return res.status(400).json({ error: 'Miner id is required' });
    }
    if (!name || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: 'Valid name required (max 100 chars)' });
    }

    const result = await pool.query(
      `UPDATE miners SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 AND (status IS NULL OR status != 'removed')
       RETURNING id, name`,
      [name.trim(), minerId, userId]
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

// DELETE /api/miners/mine/:id — remove a miner (soft delete, own miners only)
// History (tasks/earnings) is preserved; miner stops receiving dispatches.
router.delete('/mine/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const minerId = parseInt(req.params.id);

    if (!minerId) {
      return res.status(400).json({ error: 'Miner id is required' });
    }

    const result = await pool.query(
      `UPDATE miners SET status = 'removed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND (status IS NULL OR status != 'removed')
       RETURNING id`,
      [minerId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    // Drop live WS connection if connected (force re-auth which will be rejected)
    const wsServer = req.app.get('wsServer');
    if (wsServer && wsServer.miners && wsServer.miners.get(minerId)) {
      try {
        const entry = wsServer.miners.get(minerId);
        wsServer.miners.delete(minerId);
        if (entry.ws) entry.ws.close();
      } catch (e) {}
    }

    res.json({ success: true, message: 'Miner removed. Task/earning history is preserved.' });

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
// Multi-miner: same user can register unlimited miners (one row per machine_id).
router.post('/setup', async (req, res) => {
  try {
    const { email, miner_token, gpu_model, ram, cpu, models, machine_id, name } = req.body;

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
    const modelsJson = JSON.stringify(models || ['llama3.1:8b']);

    // Multi-miner path: machine_id identifies the machine (no cap on count)
    if (machine_id) {
      const existing = await pool.query(
        'SELECT id FROM miners WHERE user_id = $1 AND machine_id = $2',
        [userId, machine_id]
      );
      if (existing.rows.length > 0) {
        // Same machine re-install: update + revive if it was removed
        const result = await pool.query(
          `UPDATE miners SET gpu_model = $1, ram = $2, cpu = $3, models = $4,
                  name = COALESCE($5, name), status = 'online', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $6 AND machine_id = $7 RETURNING *`,
          [gpu_model, ram, cpu, modelsJson, name || null, userId, machine_id]
        );
        return res.json({ success: true, miner: result.rows[0] });
      }

      // New machine for this user: create additional miner row (unlimited)
      const result = await pool.query(
        `INSERT INTO miners (user_id, wallet_address, gpu_model, ram, cpu, models, machine_id, name, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'online') RETURNING *`,
        [userId, '', gpu_model || '', ram || '', cpu || '', modelsJson, machine_id, name || null]
      );
      return res.status(201).json({ success: true, miner: result.rows[0] });
    }

    // Legacy path (no machine_id): single miner per user (backward compat)
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
