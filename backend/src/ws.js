const { WebSocketServer } = require('ws');
const pool = require('./database/pool');

class WSServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.miners = new Map();
    this.taskQueue = new Map();
    this.taskCallbacks = new Map();
    this.taskIdCounter = 1;

    this.wss.on('connection', (ws) => this.handleConnection(ws));

    // Cleanup dead miners every 60s
    setInterval(() => this.cleanupMiners(), 60000);

    console.log('🔌 WebSocket server started on /ws');
  }

  handleConnection(ws) {
    console.log('New WebSocket connection');

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      for (const [minerId, miner] of this.miners) {
        if (miner.ws === ws) {
          this.miners.delete(minerId);
          pool.query("UPDATE miners SET status = 'offline' WHERE id = $1", [minerId]);
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
    const { wallet_address, miner_id } = msg;

    if (!wallet_address) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'wallet_address required' }));
      return;
    }

    // Find or register miner
    let result = await pool.query('SELECT id FROM miners WHERE wallet_address = $1', [wallet_address]);

    if (result.rows.length === 0) {
      // Auto-register miner
      result = await pool.query(
        "INSERT INTO miners (wallet_address, status) VALUES ($1, 'online') RETURNING id",
        [wallet_address]
      );
    }

    const id = result.rows[0].id;
    this.miners.set(id, {
      ws,
      wallet_address,
      lastHeartbeat: Date.now(),
      models: [],
      status: 'online'
    });

    // Update DB
    await pool.query("UPDATE miners SET status = 'online', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

    ws.send(JSON.stringify({ type: 'auth_ok', miner_id: id }));
    console.log(`Miner ${id} authenticated (${wallet_address})`);
  }

  async handleHeartbeat(ws, msg) {
    const miner = this.findMinerByWs(ws);
    if (!miner) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
      return;
    }

    const { status, gpu_usage, ram_usage, current_model } = msg;

    miner.lastHeartbeat = Date.now();
    miner.status = status || 'online';
    miner.current_model = current_model;

    await pool.query(
      `UPDATE miners
       SET status = $1,
           uptime = CASE WHEN $1 = 'online' THEN LEAST(uptime + 0.1, 100) ELSE uptime END,
           current_model = COALESCE($3, current_model),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [status || 'online', miner.id, current_model]
    );

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
  async dispatchTask(minerId, taskId, prompt, model, timeoutMs = 60000) {
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

  // Find best available miner for a model
  findMinerForModel(model) {
    for (const [minerId, miner] of this.miners) {
      if (miner.status === 'online' && miner.current_model === model) {
        return minerId;
      }
    }
    // Fallback: any online miner
    for (const [minerId, miner] of this.miners) {
      if (miner.status === 'online') {
        return minerId;
      }
    }
    return null;
  }

  cleanupMiners() {
    const now = Date.now();
    for (const [minerId, miner] of this.miners) {
      if (now - miner.lastHeartbeat > 120000) {
        this.miners.delete(minerId);
        pool.query("UPDATE miners SET status = 'offline' WHERE id = $1", [minerId]);
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
