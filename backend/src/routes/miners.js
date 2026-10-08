const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../database/pool');
const { invalidateCache } = require('../cache');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../logger');

// GET /api/miners — public network view. Deliberately excludes wallet_address
// and miner_token, and is bounded so it cannot dump the whole table.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, gpu_model, ram, cpu, status, uptime, total_tasks, earnings, current_model
         FROM miners
        WHERE status IS NULL OR status != 'removed'
        ORDER BY earnings DESC
        LIMIT 100`
    );

    res.json({
      success: true,
      miners: result.rows
    });

  } catch (err) {
    logger.error({ err }, 'GET /api/miners failed');
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
    logger.error({ err }, 'Miner route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/miners/mine — get current user's miners (all, incl. offline)
// v3.14.0: hide miner_token after first successful connect (token_used_at set).
// GET /api/miners/mine — active miners of the logged-in user.
// v3.22.0: excludes removed rows AND miners with no contact for > 10 days
// (they live in GET /api/miners/history and come back automatically if the
// miner reconnects).
router.get('/mine', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, wallet_address, gpu_model, ram, cpu, models, current_model,
              status, uptime, total_tasks, earnings, created_at, last_seen,
              gpu_usage, ram_usage, cpu_usage, disk_usage,
              machine_id, name, miner_token, token_used_at,
              CASE WHEN token_used_at IS NOT NULL THEN NULL ELSE miner_token END AS visible_token
       FROM miners
       WHERE user_id = $1
         AND (status IS NULL OR status != 'removed')
         AND COALESCE(last_seen, created_at) >= NOW() - INTERVAL '10 days'
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
    logger.error({ err }, 'Miner route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/miners/mine/model — switch current model (miner_id required for multi-miner)
router.put('/mine/model', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { model, miner_id } = req.body;

    if (!model || typeof model !== 'string') {
      return res.status(400).json({ error: 'Model is required' });
    }
    if (model.length > 100) {
      return res.status(400).json({ error: 'Model name too long' });
    }
    // Allowlist: unknown tags fall back server-side, but never persist garbage.
    const MODELS = require('../models');
    const known = MODELS.some((m) => m.id === model);
    if (!known) {
      return res.status(400).json({ error: 'Unknown model' });
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
    logger.error({ err }, 'Miner route failed');
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
    logger.error({ err }, 'Miner route failed');
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
    logger.error({ err }, 'Miner route failed');
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
      `UPDATE miners SET status = 'removed', uninstalled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
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
    logger.error({ err }, 'Miner route failed');
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
    logger.error({ err }, 'Miner route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/miners/setup — register miner via install script (v3.13.0+).
// Token-first model: each server-miner has its own unique token, and the
// token IS the miner identity. Unlimited miners per user, no cap.
router.post('/setup', async (req, res) => {
  try {
    const { email, miner_token, gpu_model, ram, cpu, models, machine_id, name } = req.body;

    if (!miner_token || typeof miner_token !== 'string') {
      return res.status(400).json({ error: 'Miner token is required' });
    }
    // Bound unbounded setup fields (install script sends free-form lscpu/free strings).
    const safeStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : v);
    const safeGpu = safeStr(gpu_model, 100);
    const safeRam = safeStr(ram, 50);
    const safeCpu = safeStr(cpu, 200);
    const safeMachine = safeStr(machine_id, 100);
    const safeName = safeStr(name, 100);
    const safeModels = Array.isArray(models) ? models.filter((m) => typeof m === 'string').map((m) => m.slice(0, 100)).slice(0, 32) : ['llama3.1:8b'];

    const modelsJson = JSON.stringify(safeModels);

    // 1) Per-miner token: binds directly to its row (revives if removed).
    const minerResult = await pool.query(
      'SELECT id, user_id, status FROM miners WHERE miner_token = $1',
      [miner_token]
    );
    if (minerResult.rows.length > 0) {
      if (minerResult.rows[0].status === 'removed') {
        return res.status(401).json({ error: 'This miner was removed. Re-add it from your profile to use it again.' });
      }
      const minerId = minerResult.rows[0].id;
      const result = await pool.query(
        `UPDATE miners SET gpu_model = $1, ram = $2, cpu = $3, models = $4,
                machine_id = COALESCE($5, machine_id), name = COALESCE($6, name),
                status = 'online', token_used_at = COALESCE(token_used_at, CURRENT_TIMESTAMP),
                last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [safeGpu, safeRam, safeCpu, modelsJson, safeMachine || null, (safeName || '').trim() || null, minerId]
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
            `UPDATE miners SET gpu_model = $1, ram = $2, cpu = $3, models = $4, status = 'online', last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 RETURNING *`,
            [safeGpu, safeRam, safeCpu, modelsJson, owned.rows[0].id]
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
    logger.error({ err }, 'Miner route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/miners/register — DISABLED (use /setup with email + token instead)
router.post('/register', authenticate, async (req, res) => {
  return res.status(403).json({ error: 'Manual registration disabled. Use /api/miners/setup with email and miner token.' });
});

// POST /api/miners/unregister — called by uninstall-*.sh (v3.22.0).
// The miner_token itself is the credential (same trust model as /setup): it
// proves control of that machine. Idempotent — an unknown or already-removed
// token still answers success so uninstall never fails on the server side.
router.post('/unregister', async (req, res) => {
  try {
    const { miner_token } = req.body || {};
    if (!miner_token || typeof miner_token !== 'string') {
      return res.status(400).json({ error: 'miner_token required' });
    }

    const result = await pool.query(
      `UPDATE miners SET status = 'removed', uninstalled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE miner_token = $1 AND (status IS NULL OR status != 'removed')
       RETURNING id`,
      [miner_token]
    );

    if (result.rows.length > 0) {
      // Drop a live WS connection so dispatch stops immediately.
      const wsServer = req.app.get('wsServer');
      if (wsServer && wsServer.miners && wsServer.miners.get(result.rows[0].id)) {
        try {
          const entry = wsServer.miners.get(result.rows[0].id);
          wsServer.miners.delete(result.rows[0].id);
          if (entry.ws) entry.ws.close();
        } catch (e) {}
      }
      invalidateCache('/api/miners');
      invalidateCache('/api/stats');
    }

    res.json({ success: true, unregistered: result.rows.length > 0 });
  } catch (err) {
    logger.error({ err }, 'Miner unregister failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/miners/history — miners removed from the dashboard or by the
// uninstall script, plus miners with no contact for > 10 days (auto-archived;
// they return to /mine automatically if they ever reconnect).
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, name, gpu_model, status, total_tasks, earnings,
              created_at, last_seen, uninstalled_at,
              CASE WHEN status = 'removed' THEN 'uninstalled' ELSE 'offline>10d' END AS reason
       FROM miners
       WHERE user_id = $1
         AND (status = 'removed'
              OR COALESCE(last_seen, created_at) < NOW() - INTERVAL '10 days')
       ORDER BY COALESCE(uninstalled_at, last_seen, created_at) DESC`,
      [userId]
    );

    // Summary over ALL miners ever added by this user (active included).
    const summary = await pool.query(
      `SELECT COUNT(*)::int AS total_added,
              COALESCE(SUM(total_tasks), 0)::int AS total_tasks,
              COALESCE(SUM(earnings), 0)::float AS total_earnings
       FROM miners WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, miners: result.rows, summary: summary.rows[0] });
  } catch (err) {
    logger.error({ err }, 'Miner history route failed');
    res.status(500).json({ error: 'Server error' });
  }
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

    // Whitelist caller-controlled fields: a heartbeat may never resurrect a
    // removed miner, invent a status, or inflate the task counter.
    const statusValue = ['online', 'offline', 'busy'].includes(status) ? status : 'online';
    const taskDelta = Math.max(0, Math.min(1000, parseInt(tasks_completed, 10) || 0));

    const result = await pool.query(
      `UPDATE miners
       SET status = $1,
           uptime = CASE WHEN $1 = 'online' THEN LEAST(uptime + 0.1, 100) ELSE uptime END,
           total_tasks = total_tasks + $2,
           current_model = COALESCE($4, current_model),
           last_seen = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND (status IS NULL OR status != 'removed')
       RETURNING *`,
      [statusValue, taskDelta, id, current_model]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    res.json({
      success: true,
      miner: result.rows[0]
    });

  } catch (err) {
    logger.error({ err }, 'Miner route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/miners/:id — owner only (used to be public and leaked
// wallet_address + earnings for any miner id).
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, wallet_address, gpu_model, ram, cpu, models, current_model, status, uptime,
              total_tasks, earnings, created_at, gpu_usage, ram_usage, cpu_usage, disk_usage,
              machine_id, name, token_used_at
         FROM miners
        WHERE id = $1 AND user_id = $2 AND (status IS NULL OR status != 'removed')`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miner not found' });
    }

    res.json({
      success: true,
      miner: result.rows[0]
    });

  } catch (err) {
    logger.error({ err }, 'Miner route failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
