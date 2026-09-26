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

// POST /api/miners — create a new miner for the current user (v3.13.0+).
// Each server-miner gets its own unique token (unlimited per user, no cap).
// v3.14.0: empty name defaults to "miner1"; token is single-use for display.
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (name !== undefined && name !== null && name !== '' && (typeof name !== 'string' || name.trim().length > 100)) {
      return res.status(400).json({ error: 'Valid name required (max 100 chars)' });
    }

    const minerToken = 'kz_' + crypto.randomBytes(32).toString('hex');
    const minerName = (name || '').trim() || 'miner1';

    const result = await pool.query(
      `INSERT INTO miners (user_id, wallet_address, name, miner_token, status)
       VALUES ($1, '', $2, $3, 'offline') RETURNING *`,
      [userId, minerName, minerToken]
    );

    invalidateCache('/api/miners');
    invalidateCache('/api/stats');
    res.status(201).json({ success: true, miner: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/miners/mine — get current user's miners (all, incl. offline)
// v3.14.0: hide miner_token after first successful connect (token_used_at set).
router.get('/mine', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, wallet_address, gpu_model, ram, cpu, models, current_model,
              status, uptime, total_tasks, earnings, created_at,
              gpu_usage, ram_usage, cpu_usage, disk_usage,
              machine_id, name, miner_token, token_used_at,
              CASE WHEN token_used_at IS NOT NULL THEN NULL ELSE miner_token END AS visible_token
       FROM miners WHERE user_id = $1 AND (status IS NULL OR status != 'removed')
       ORDER BY created_at ASC`,
      [userId]
    );

    // Return rows with miner_token null when already used (single-use display)
    const miners = result.rows.map(r => ({
      ...r,
      miner_token: r.token_used_at ? null : r.miner_token,
      visible_token: undefined
    }));

    res.json({
      success: true,
      miners,
      // Legacy: first miner (backward compat for old clients)
      miner: miners[0] || null
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

// PUT /api/miners/mine/:id/token — rotate token for reinstall same machine (v3.14.0)
// Generates a new unique token, clears token_used_at so it can be shown again.
router.put('/mine/:id/token', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const minerId = parseInt(req.params.id);

    if (!minerId) {
      return res.status(400).json({ error: 'Miner id is required' });
    }

    const newToken = 'kz_' + crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `UPDATE miners SET miner_token = $1, token_used_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 AND (status IS NULL OR status != 'removed')
       RETURNING id, name, miner_token`,
      [newToken, minerId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    invalidateCache('/api/miners');
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

    invalidateCache('/api/miners');
    invalidateCache('/api/stats');
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

// POST /api/miners/setup — register miner via install script (v3.13.0+).
// Token-first model: each server-miner has its own unique token, and the
// token IS the miner identity. Unlimited miners per user, no cap.
router.post('/setup', async (req, res) => {
  try {
    const { email, miner_token, gpu_model, ram, cpu, models, machine_id, name } = req.body;

    if (!miner_token) {
      return res.status(400).json({ error: 'Miner token is required' });
    }

    const modelsJson = JSON.stringify(models || ['llama3.1:8b']);

    // 1) Per-miner token: binds directly to its row (revives if removed).
    const minerResult = await pool.query(
      'SELECT id, user_id, status FROM miners WHERE miner_token = $1',
      [miner_token]
    );
    if (minerResult.rows.length > 0) {
      const minerId = minerResult.rows[0].id;
      const result = await pool.query(
        `UPDATE miners SET gpu_model = $1, ram = $2, cpu = $3, models = $4,
                machine_id = COALESCE($5, machine_id), name = COALESCE($6, name),
                status = 'online', token_used_at = COALESCE(token_used_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [gpu_model, ram, cpu, modelsJson, machine_id || null, (name || '').trim() || null, minerId]
      );
      invalidateCache('/api/miners');
      invalidateCache('/api/stats');
      return res.json({ success: true, miner: result.rows[0] });
    }

    // 2) Legacy account token (users.miner_token): only unambiguous when the
    // user has exactly 1 active miner; otherwise require the per-miner token.
    if (email) {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND miner_token = $2',
        [email, miner_token]
      );
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        const owned = await pool.query(
          `SELECT id FROM miners WHERE user_id = $1 AND (status IS NULL OR status != 'removed')
           ORDER BY id ASC`,
          [userId]
        );
        if (owned.rows.length === 1) {
          const result = await pool.query(
            `UPDATE miners SET gpu_model = $1, ram = $2, cpu = $3, models = $4, status = 'online', updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 RETURNING *`,
            [gpu_model, ram, cpu, modelsJson, owned.rows[0].id]
          );
          return res.json({ success: true, miner: result.rows[0] });
        }
        if (owned.rows.length > 1) {
          return res.status(409).json({ error: 'Multiple miners found. Use the per-miner token from your profile for this machine.' });
        }
      }
    }

    return res.status(401).json({ error: 'Invalid miner token' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/miners/register — DISABLED (use /setup with email + token instead)
router.post('/register', authenticate, async (req, res) => {
  return res.status(403).json({ error: 'Manual registration disabled. Use /api/miners/setup with email and miner token.' });
});

// PUT /api/miners/:id/heartbeat — requires the miner's own token (v3.18.4)
router.put('/:id/heartbeat', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, gpu_usage, ram_usage, tasks_completed, current_model, miner_token } = req.body;

    if (!miner_token) {
      return res.status(401).json({ error: 'miner_token required' });
    }

    const auth = await pool.query('SELECT id FROM miners WHERE id = $1 AND miner_token = $2', [id, miner_token]);
    if (auth.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid miner token' });
    }

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
