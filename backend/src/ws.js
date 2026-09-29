const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const pool = require('./database/pool');
const { invalidateCache } = require('./cache');
const { deriveKey, encrypt, decrypt, isEncrypted } = require('./services/e2e');
const { logger } = require('./logger');

const TOKEN_RE = /^kz_[0-9a-f]{32,64}$/;
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_WINDOW = 5 * 60 * 1000;

// v3.20.0 added the `attachment` field on task messages (images/voice notes).
// Older miner binaries destructure only {task_id, prompt, model} and would
// silently drop the attachment, so media tasks must only be handed to miners
// that advertised app_version >= 3.20.0 at auth. No version = old binary.
function minerSupportsMedia(version) {
  if (!version) return false;
  const [maj = 0, min = 0] = String(version).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  return maj > 3 || (maj === 3 && min >= 20);
}

// Resolve the real client IP behind the reverse proxy.
// Trust order matters: nginx overwrites X-Real-IP and APPENDS the real peer to
// X-Forwarded-For, so the LAST hop is the only trustworthy one. Client-supplied
// CF-Connecting-IP / the first XFF entry must never be trusted — otherwise a
// spoofed 127.0.0.1 bypasses the auth rate limiter and the session-replacement
// guard (isLocalClient).
function resolveClientIp(headers, ws) {
  const realIp = headers['x-real-ip'];
  if (realIp) return String(realIp).trim();

  const xff = headers['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  if (ws._socket && ws._socket.remoteAddress) return ws._socket.remoteAddress;
  return 'unknown';
}

function isLocalClient(ws) {
  // Trust only the client-facing IP (_clientIp). Behind nginx, socket.remoteAddress
  // is always 127.0.0.1 and would wrongly mark every proxied miner as local.
  const ip = String(ws._clientIp || '');
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('::ffff:127.0.0.1')
  );
}

class WSServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.miners = new Map();
    this.taskQueue = new Map();
    this.taskCallbacks = new Map();
    this.taskIdCounter = 1;
    // Per-IP failed WS auth attempts (rate limit)
    this.authFails = new Map();

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => {
      logger.error({ err }, 'WebSocket server error');
    });

    // Cleanup dead miners every 60s (unref so the process can exit on shutdown)
    this.cleanupTimer = setInterval(() => this.cleanupMiners(), 60000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();

    logger.info('WebSocket server started on /ws');
  }

  handleConnection(ws, req) {
    const headers = (req && req.headers) || (ws.upgradeReq && ws.upgradeReq.headers) || {};
    ws._clientIp = resolveClientIp(headers, ws);
    logger.info({ ip: ws._clientIp }, 'New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (err) {
        logger.error({ err }, 'WS message error');
        ws.send(JSON.stringify({ type: 'error', message: err.message || 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      for (const [minerId, miner] of this.miners) {
        if (miner.ws === ws) {
          this.miners.delete(minerId);
          pool.query("UPDATE miners SET status = 'offline' WHERE id = $1", [minerId])
            .catch((err) => logger.error({ err, minerId }, 'Failed to mark miner offline'));
          invalidateCache('/api/miners');
          invalidateCache('/api/models');
          invalidateCache('/api/stats');
          logger.info({ minerId }, 'Miner disconnected');
        }
      }
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'WebSocket error');
    });
  }

  async handleMessage(ws, msg) {
    switch (msg.type) {
      case 'auth':
        await this.handleAuth(ws, msg);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(ws, msg);
        break;
      case 'task_result':
        await this.handleTaskResult(ws, msg);
        break;
      case 'task_request':
        await this.handleTaskRequest(ws, msg);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  // Returns true when this IP has burned through its failed-auth budget
  authRateLimited(ws) {
    // Localhost (VPS-resident, incl. our own miner + proxied nginx path is NOT
    // local — _clientIp is the real client IP there) is trusted: rate limiting
    // targets remote token brute-force.
    if (isLocalClient(ws)) return false;
    const ip = ws._clientIp || 'unknown';
    const now = Date.now();
    const rec = this.authFails.get(ip);
    if (!rec || now - rec.windowStart > AUTH_FAIL_WINDOW) {
      if (rec) this.authFails.delete(ip);
      return false;
    }
    if (rec.count >= AUTH_FAIL_LIMIT) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Too many failed attempts. Try again in 5 minutes.' }));
      try { ws.close(); } catch (e) {}
      return true;
    }
    return false;
  }

  recordAuthFailure(ws) {
    const ip = ws._clientIp || 'unknown';
    const now = Date.now();
    const rec = this.authFails.get(ip);
    if (!rec || now - rec.windowStart > AUTH_FAIL_WINDOW) {
      this.authFails.set(ip, { count: 1, windowStart: now });
    } else {
      rec.count += 1;
    }
  }

  async handleAuth(ws, msg) {
    const { wallet_address, miner_token, e2e } = msg;
    // v3.20.0: miners advertise their version at auth so media dispatch can
    // target only miners that understand the `attachment` field on tasks.
    const appVersion = typeof msg.app_version === 'string' && msg.app_version
      ? msg.app_version.slice(0, 32)
      : null;

    if (this.authRateLimited(ws)) return;

    // Must have either wallet_address or miner_token
    if (!wallet_address && !miner_token) {
      this.recordAuthFailure(ws);
      ws.send(JSON.stringify({ type: 'auth_error', message: 'wallet_address or miner_token required' }));
      return;
    }

    // Token hygiene: reject malformed tokens before touching the DB
    if (miner_token && !TOKEN_RE.test(miner_token)) {
      this.recordAuthFailure(ws);
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid miner token' }));
      return;
    }

    let result;
    let minerId;

    // If miner_token provided, find user's miner via token
    // v3.13.0 token-first model: each server-miner has its own unique token,
    // and the token IS the miner identity (unlimited miners per user).
    if (miner_token) {
      const minerRow = await pool.query(
        'SELECT id, status FROM miners WHERE miner_token = $1',
        [miner_token]
      );
      if (minerRow.rows.length > 0) {
        if (minerRow.rows[0].status === 'removed') {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'This miner was removed. Re-add it from your profile to use it again.' }));
          return;
        }
        minerId = minerRow.rows[0].id;
        // v3.14.0: first successful auth marks token as used (hide from profile)
        await pool.query(
          "UPDATE miners SET status = 'online', token_used_at = COALESCE(token_used_at, CURRENT_TIMESTAMP), last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [minerId]
        );
        invalidateCache('/api/miners');
      } else {
        // Legacy account token (users.miner_token): unambiguous only when the
        // user has exactly 1 active miner.
        const userResult = await pool.query('SELECT id FROM users WHERE miner_token = $1', [miner_token]);
        if (userResult.rows.length === 0) {
          this.recordAuthFailure(ws);
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid miner token' }));
          return;
        }
        const userId = userResult.rows[0].id;
        const owned = await pool.query(
          `SELECT id FROM miners WHERE user_id = $1 AND (status IS NULL OR status != 'removed')
           ORDER BY id ASC`,
          [userId]
        );
        if (owned.rows.length === 1) {
          minerId = owned.rows[0].id;
          await pool.query("UPDATE miners SET status = 'online', last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [minerId]);
        } else if (owned.rows.length > 1) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Multiple miners found. Use the per-miner token from your profile for this machine.' }));
          return;
        } else {
          const freshToken = 'kz_' + crypto.randomBytes(32).toString('hex');
          result = await pool.query(
            "INSERT INTO miners (user_id, wallet_address, miner_token, status) VALUES ($1, $2, $3, 'online') RETURNING id",
            [userId, wallet_address || '', freshToken]
          );
          minerId = result.rows[0].id;
        }
      }
    } else {
      // Legacy: wallet_address only
      result = await pool.query('SELECT id, status FROM miners WHERE wallet_address = $1', [wallet_address]);
      if (result.rows.length === 0) {
        result = await pool.query(
          "INSERT INTO miners (wallet_address, status) VALUES ($1, 'online') RETURNING id",
          [wallet_address]
        );
      } else if (result.rows[0].status === 'removed') {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'This miner was removed. Re-add it from your profile to use it again.' }));
        return;
      }
      minerId = result.rows[0].id;
    }

    // If this miner already has a live entry (stale/zombie connection),
    // close the old socket first so the map always points at the newest
    // connection. Otherwise dispatches and heartbeats split across two
    // sockets and the live miner gets "Not authenticated".
    const existing = this.miners.get(minerId);
    // Idempotent re-auth on the same socket: skip replace + duplicate work
    if (existing && existing.ws === ws) {
      existing.lastHeartbeat = Date.now();
      existing.status = 'online';
      if (appVersion) existing.app_version = appVersion;
      if (e2e && miner_token) {
        existing.e2eKey = deriveKey(miner_token);
      }
      ws.send(JSON.stringify({ type: 'auth_ok', miner_id: minerId, e2e: !!(existing.e2eKey) }));
      return;
    }
    if (existing && existing.ws && existing.ws !== ws) {
      // Heartbeat every 30s → allow up to 45s skew before treating as stale
      const oldHealthy = Date.now() - (existing.lastHeartbeat || 0) < 45000;
      const newIsLocal = isLocalClient(ws);
      if (oldHealthy && !newIsLocal) {
        logger.warn({ minerId, ip: ws._clientIp, existingIp: existing.ws._clientIp }, 'Rejected duplicate miner session');
        this.recordAuthFailure(ws);
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Miner already connected. Stop the other session or wait for it to go offline.' }));
        try { ws.close(); } catch (e) {}
        return;
      }
      try {
        if (existing.ws.readyState === 1) {
          existing.ws.send(JSON.stringify({ type: 'error', message: 'Replaced by newer connection' }));
          existing.ws.close();
        }
      } catch (e) {}
      logger.info({ minerId, oldIp: existing.ws && existing.ws._clientIp, newIp: ws._clientIp }, 'Miner session replaced');
    }

    if (appVersion) {
      await pool.query('UPDATE miners SET app_version = $1 WHERE id = $2', [appVersion, minerId])
        .catch((err) => logger.warn({ err, minerId }, 'Failed to persist miner app_version'));
    }

    this.miners.set(minerId, {
      id: minerId,
      ws,
      wallet_address: wallet_address || '',
      lastHeartbeat: Date.now(),
      models: [],
      status: 'online',
      current_model: (existing && existing.current_model) || null,
      app_version: appVersion || (existing && existing.app_version) || null,
      // E2E key only when THIS auth advertised e2e support (never inherit from
      // a replaced session — an old miner binary replacing it must stay plaintext)
      e2eKey: (e2e && miner_token) ? deriveKey(miner_token) : null
    });

    // Update DB (v3.14.0: also mark token_used on first auth)
    await pool.query(
      "UPDATE miners SET status = 'online', token_used_at = COALESCE(token_used_at, CURRENT_TIMESTAMP), last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [minerId]
    );
    invalidateCache('/api/miners');
    invalidateCache('/api/models');
    invalidateCache('/api/stats');

    // Successful auth resets this IP's failed-attempt counter
    this.authFails.delete(ws._clientIp || 'unknown');
    const session = this.miners.get(minerId);
    ws.send(JSON.stringify({ type: 'auth_ok', miner_id: minerId, e2e: !!session.e2eKey }));
    logger.info({ minerId, ip: ws._clientIp, e2e: !!session.e2eKey }, 'Miner authenticated');
  }

  async handleHeartbeat(ws, msg) {
    const miner = this.findMinerByWs(ws);
    if (!miner) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
      return;
    }

const { status, gpu_usage, ram_usage, cpu_usage, disk_usage, current_model } = msg;

    miner.lastHeartbeat = Date.now();
    miner.status = status || 'online';
    miner.current_model = current_model;

    const statusValue = status || 'online';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE miners
         SET status = $1,
             uptime = CASE WHEN $8 = 'online' THEN LEAST(uptime + 0.1, 100) ELSE uptime END,
             current_model = COALESCE($3, current_model),
             gpu_usage = $4,
             ram_usage = $5,
             cpu_usage = $6,
             disk_usage = $7,
             last_seen = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [statusValue, miner.id, current_model,
         gpu_usage || 0, ram_usage || 0, cpu_usage || 0, disk_usage || 0, statusValue]
      );
      invalidateCache('/api/miners');
      invalidateCache('/api/models');
      invalidateCache('/api/stats');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, minerId: miner.id }, 'Heartbeat DB error');
    } finally {
      client.release();
    }

    ws.send(JSON.stringify({ type: 'heartbeat_ok' }));
  }

  async handleTaskResult(ws, msg) {
    const { task_id, response, tokens_used, error } = msg;

    if (!task_id) return;

    // v3.18.4: results only accepted from an authenticated miner session,
    // and only for tasks assigned to that miner (stops result forgery).
    const miner = this.findMinerByWs(ws);
    if (!miner) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
      return;
    }

    const taskRow = await pool.query('SELECT miner_id FROM tasks WHERE id = $1', [task_id]);
    if (taskRow.rows.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown task' }));
      return;
    }
    if (taskRow.rows[0].miner_id !== miner.id) {
      // NULL miner_id tasks are never dispatched over WS, so a strict match
      // here blocks forged/foreign results without breaking legitimate flows.
      ws.send(JSON.stringify({ type: 'error', message: 'Task not assigned to this miner' }));
      return;
    }

    // Decrypt e2e payload when the session negotiated encryption
    let plainResponse = response;
    if (miner.e2eKey && response !== undefined && !isEncrypted(response)) {
      // Session negotiated e2e but plaintext arrived — refuse (downgrade/forge)
      logger.error({ taskId: task_id, minerId: miner.id }, 'Plaintext result rejected (e2e negotiated)');
      ws.send(JSON.stringify({ type: 'error', message: 'Plaintext result rejected (e2e required)' }));
      return;
    }
    if (isEncrypted(response)) {
      if (!miner.e2eKey) {
        ws.send(JSON.stringify({ type: 'error', message: 'E2E not negotiated' }));
        return;
      }
      try {
        plainResponse = decrypt(miner.e2eKey, response);
      } catch (err) {
        logger.error({ err, taskId: task_id, minerId: miner.id }, 'E2E decrypt failed');
        ws.send(JSON.stringify({ type: 'error', message: 'E2E decrypt failed' }));
        return;
      }
    }

    if (error) {
      await pool.query(
        "UPDATE tasks SET response = $1, status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $2 AND status IN ('pending', 'processing')",
        [error, task_id]
      );
    } else {
      // This handler only records the raw result. Billing (cost, miner earnings,
      // daily tokens) is owned exclusively by routes/chat.js so a task is never
      // paid twice and the user is always charged the published model price.
      const updated = await pool.query(
        `UPDATE tasks
            SET response = $1, tokens_used = $2, status = 'completed', completed_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND status IN ('pending', 'processing')
          RETURNING id`,
        [plainResponse, tokens_used || 0, task_id]
      );

      if (updated.rows.length === 0) {
        // Replay of an already-resolved task: do not touch counters or state.
        logger.warn({ taskId: task_id, minerId: miner.id }, 'Ignored replayed task_result');
        return;
      }
    }

    // Callback for pending task
    const callback = this.taskCallbacks.get(task_id);
    if (callback) {
      clearTimeout(callback.timeout);
      this.taskCallbacks.delete(task_id);
      callback.resolve({ response: plainResponse, tokens_used, error });
    }
  }

  async handleTaskRequest(ws, msg) {
    // Miner is requesting a task (polling mode)
    const miner = this.findMinerByWs(ws);
    if (!miner) return;

    // Find pending task for this miner. Older miners must not pick up media
    // tasks (they would silently drop the attachment) — those stay pending
    // until a v3.20.0+ miner asks or the request path fails explicitly.
    const mediaCapable = minerSupportsMedia(miner.app_version);
    const result = await pool.query(
      `SELECT id, prompt, prepared_prompt, media, model FROM tasks
        WHERE miner_id = $1 AND status = 'pending'
        ORDER BY created_at ASC LIMIT 50`,
      [miner.id]
    );

    for (const task of result.rows) {
      const needsMedia = task.media && (task.media.type === 'image' || task.media.type === 'audio');
      if (needsMedia && !mediaCapable) continue;

      const upd = await pool.query(
        "UPDATE tasks SET status = 'processing' WHERE id = $1 AND status = 'pending' RETURNING id",
        [task.id]
      );
      if (upd.rows.length === 0) continue; // another connection claimed it
      const payload = {
        type: 'task',
        task_id: task.id,
        prompt: miner.e2eKey ? encrypt(miner.e2eKey, task.prepared_prompt || task.prompt) : (task.prepared_prompt || task.prompt),
        model: task.model
      };
      if (needsMedia) {
        payload.attachment = miner.e2eKey ? encrypt(miner.e2eKey, JSON.stringify(task.media)) : task.media;
      }
      ws.send(JSON.stringify(payload));
      return;
    }
  }

  findMinerByWs(ws) {
    for (const [, miner] of this.miners) {
      if (miner.ws === ws) return miner;
    }
    return null;
  }

  // Dispatch task to a specific miner
  // NOTE: CPU-only miners need ~2-3 min for an 8B model (model load + inference),
  // so the timeout must stay well above the 60s it used to be.
  // media (image/audio {type,name,mime,data} base64) rides as `attachment`,
  // encrypted the same way the prompt is when E2E is negotiated.
  async dispatchTask(minerId, taskId, prompt, model, media = null, timeoutMs = 180000) {
    return new Promise((resolve, reject) => {
      const miner = this.miners.get(minerId);
      if (!miner) {
        reject(new Error('Miner not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        this.taskCallbacks.delete(taskId);
        reject(new Error('Task timeout'));
      }, timeoutMs);

      this.taskCallbacks.set(taskId, { resolve, reject, timeout });

      const payload = {
        type: 'task',
        task_id: taskId,
        prompt: miner.e2eKey ? encrypt(miner.e2eKey, prompt) : prompt,
        model
      };
      if (media) {
        payload.attachment = miner.e2eKey
          ? encrypt(miner.e2eKey, JSON.stringify(media))
          : media;
      }
      miner.ws.send(JSON.stringify(payload));
    });
  }

  // Find best available miner for a model (resource-aware).
  // needsMedia: only miners running >= 3.20.0 (which understand `attachment`).
  findMinerForModel(model, needsMedia = false) {
    const usable = (miner) =>
      miner.status === 'online' && (!needsMedia || minerSupportsMedia(miner.app_version));

    // Prefer exact model match on online miners
    for (const [minerId, miner] of this.miners) {
      if (usable(miner) && miner.current_model === model) {
        return { minerId, model: miner.current_model };
      }
    }
    // Fallback: any online miner (use its model)
    for (const [minerId, miner] of this.miners) {
      if (usable(miner)) {
        return { minerId, model: miner.current_model };
      }
    }
    return null;
  }

  cleanupMiners() {
    const now = Date.now();
    for (const [minerId, miner] of this.miners) {
      if (now - miner.lastHeartbeat > 120000) {
        this.miners.delete(minerId);
        pool.query("UPDATE miners SET status = 'offline' WHERE id = $1", [minerId])
          .catch((err) => logger.error({ err, minerId }, 'Failed to mark miner offline'));
        invalidateCache('/api/miners');
        invalidateCache('/api/models');
        invalidateCache('/api/stats');
        logger.info({ minerId }, 'Miner marked offline (no heartbeat)');
      }
    }
  }

  // Graceful shutdown: drop timers, fail in-flight dispatches, close sockets.
  async close() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const [, cb] of this.taskCallbacks) {
      clearTimeout(cb.timeout);
      try { cb.reject(new Error('Server shutting down')); } catch (e) { /* already settled */ }
    }
    this.taskCallbacks.clear();
    for (const [, miner] of this.miners) {
      try { miner.ws.close(); } catch (e) { /* noop */ }
    }
    this.miners.clear();
    await new Promise((resolve) => this.wss.close(() => resolve()));
  }

  getOnlineMiners() {
    const online = [];
    for (const [minerId, miner] of this.miners) {
      if (miner.status === 'online') {
        online.push({ id: minerId, wallet_address: miner.wallet_address, model: miner.current_model });
      }
    }
    return online;
  }
}

module.exports = WSServer;
