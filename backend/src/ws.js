const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const pool = require('./database/pool');
const { invalidateCache } = require('./cache');

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

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => {
      console.error('❌ WebSocket server error:', err.message);
    });

    // Cleanup dead miners every 60s
    setInterval(() => this.cleanupMiners(), 60000);

    console.log('🔌 WebSocket server started on /ws');
  }

  handleConnection(ws, req) {
    const headers = (req && req.headers) || (ws.upgradeReq && ws.upgradeReq.headers) || {};
    const remote =
      headers['cf-connecting-ip'] ||
      (headers['x-forwarded-for'] && headers['x-forwarded-for'].split(',')[0].trim()) ||
      headers['x-real-ip'] ||
      (ws._socket && ws._socket.remoteAddress) ||
      'unknown';
    ws._clientIp = remote;
    console.log(`New WebSocket connection from ${remote}`);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (err) {
        console.error('WS message error:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: err.message || 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      for (const [minerId, miner] of this.miners) {
        if (miner.ws === ws) {
          this.miners.delete(minerId);
          pool.query("UPDATE miners SET status = 'offline' WHERE id = $1", [minerId]);
          invalidateCache('/api/miners');
          invalidateCache('/api/models');
          invalidateCache('/api/stats');
          console.log(`Miner ${minerId} disconnected`);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
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

  async handleAuth(ws, msg) {
    const { wallet_address, miner_token } = msg;

    // Must have either wallet_address or miner_token
    if (!wallet_address && !miner_token) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'wallet_address or miner_token required' }));
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
          "UPDATE miners SET status = 'online', token_used_at = COALESCE(token_used_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [minerId]
        );
        invalidateCache('/api/miners');
      } else {
        // Legacy account token (users.miner_token): unambiguous only when the
        // user has exactly 1 active miner.
        const userResult = await pool.query('SELECT id FROM users WHERE miner_token = $1', [miner_token]);
        if (userResult.rows.length === 0) {
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
          await pool.query("UPDATE miners SET status = 'online', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [minerId]);
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
      ws.send(JSON.stringify({ type: 'auth_ok', miner_id: minerId }));
      return;
    }
    if (existing && existing.ws && existing.ws !== ws) {
      // Heartbeat every 30s → allow up to 45s skew before treating as stale
      const oldHealthy = Date.now() - (existing.lastHeartbeat || 0) < 45000;
      const newIsLocal = isLocalClient(ws);
      if (oldHealthy && !newIsLocal) {
        console.log(`Miner ${minerId} rejected newcomer from ${ws._clientIp} (healthy session from ${existing.ws._clientIp})`);
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
      console.log(`Miner ${minerId} previous connection replaced (old=${existing.ws && existing.ws._clientIp} new=${ws._clientIp})`);
    }

    this.miners.set(minerId, {
      id: minerId,
      ws,
      wallet_address: wallet_address || '',
      lastHeartbeat: Date.now(),
      models: [],
      status: 'online',
      current_model: (existing && existing.current_model) || null
    });

    // Update DB (v3.14.0: also mark token_used on first auth)
    await pool.query(
      "UPDATE miners SET status = 'online', token_used_at = COALESCE(token_used_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [minerId]
    );
    invalidateCache('/api/miners');
    invalidateCache('/api/models');
    invalidateCache('/api/stats');

    ws.send(JSON.stringify({ type: 'auth_ok', miner_id: minerId }));
    console.log(`Miner ${minerId} authenticated from ${ws._clientIp} (${wallet_address || miner_token?.slice(0, 10) + '...'})`);
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
      console.error(`Heartbeat DB error for miner ${miner.id}:`, err.message);
    } finally {
      client.release();
    }

    ws.send(JSON.stringify({ type: 'heartbeat_ok' }));
  }

  async handleTaskResult(ws, msg) {
    const { task_id, response, tokens_used, error } = msg;

    if (!task_id) return;

    if (error) {
      await pool.query(
        "UPDATE tasks SET response = $1, status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $2",
        [error, task_id]
      );
    } else {
      const cost = (tokens_used || 0) * 0.001;
      const minerFee = cost * 0.9;
      const platformFee = cost * 0.1;

      await pool.query(
        `UPDATE tasks
         SET response = $1, tokens_used = $2, cost = $3, status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [response, tokens_used || 0, cost, task_id]
      );

      // Update miner earnings
      const taskResult = await pool.query('SELECT miner_id FROM tasks WHERE id = $1', [task_id]);
      if (taskResult.rows.length > 0 && taskResult.rows[0].miner_id) {
        await pool.query(
          'UPDATE miners SET total_tasks = total_tasks + 1, earnings = earnings + $1 WHERE id = $2',
          [minerFee, taskResult.rows[0].miner_id]
        );
      }
    }

    // Callback for pending task
    const callback = this.taskCallbacks.get(task_id);
    if (callback) {
      clearTimeout(callback.timeout);
      this.taskCallbacks.delete(task_id);
      callback.resolve({ response, tokens_used, error });
    }
  }

  async handleTaskRequest(ws, msg) {
    // Miner is requesting a task (polling mode)
    const miner = this.findMinerByWs(ws);
    if (!miner) return;

    // Find pending task for this miner
    const result = await pool.query(
      "SELECT id, prompt, model FROM tasks WHERE miner_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 1",
      [miner.id]
    );

    if (result.rows.length > 0) {
      const task = result.rows[0];
      await pool.query("UPDATE tasks SET status = 'processing' WHERE id = $1", [task.id]);
      ws.send(JSON.stringify({
        type: 'task',
        task_id: task.id,
        prompt: task.prompt,
        model: task.model
      }));
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
  async dispatchTask(minerId, taskId, prompt, model, timeoutMs = 180000) {
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

      miner.ws.send(JSON.stringify({
        type: 'task',
        task_id: taskId,
        prompt,
        model
      }));
    });
  }

  // Find best available miner for a model (resource-aware)
  findMinerForModel(model) {
    // Prefer exact model match on online miners
    for (const [minerId, miner] of this.miners) {
      if (miner.status === 'online' && miner.current_model === model) {
        return { minerId, model: miner.current_model };
      }
    }
    // Prefer free-cloud-ai never needs a miner — skip miner for it
    if (model === 'free-cloud-ai') {
      return null;
    }
    // Fallback: any online miner (use its model)
    for (const [minerId, miner] of this.miners) {
      if (miner.status === 'online') {
        return { minerId, model: miner.current_model };
      }
    }
    return null;
  }

  cleanupMiners() {
    console.log('>>> Cleanup miners running, miners count:', this.miners.size);
    const now = Date.now();
    for (const [minerId, miner] of this.miners) {
      const timeSinceHeartbeat = now - miner.lastHeartbeat;
      console.log(`>>> Cleanup check miner ${minerId}: lastHeartbeat ${timeSinceHeartbeat}ms ago`);
      if (timeSinceHeartbeat > 120000) {
        this.miners.delete(minerId);
        pool.query("UPDATE miners SET status = 'offline' WHERE id = $1", [minerId]);
        invalidateCache('/api/miners');
        invalidateCache('/api/models');
        invalidateCache('/api/stats');
        console.log(`Miner ${minerId} marked offline (no heartbeat)`);
      }
    }
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
