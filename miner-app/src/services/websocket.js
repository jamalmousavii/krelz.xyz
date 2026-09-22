const WebSocket = require('ws');

class MinerWebSocket {
  constructor(walletAddress, onTask, opts = {}) {
    this.walletAddress = walletAddress;
    this.onTask = onTask;
    this.machineId = opts.machineId || process.env.MINER_MACHINE_ID || null;
    this.minerName = opts.minerName || process.env.MINER_NAME || null;
    this.lastReauthAt = 0;
    this.ws = null;
    this.minerId = null;
    this.connected = false;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
  }

  connect() {
    const wsUrl = process.env.API_WS_URL || 'wss://krelz.xyz:443/ws';
    this.ws = new WebSocket(wsUrl, {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
      // SNI must match the TLS cert (issued for krelz.xyz)
      servername: 'krelz.xyz',
    });

    this.ws.on('open', () => {
      console.log('🔌 Connected to Krelz Network');
      this.connected = true;
      this.reconnectDelay = 5000;
      this.authenticate();
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error('Invalid WS message:', err.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log('🔌 Disconnected from Krelz Network');
      this.connected = false;
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });
  }

  authenticate() {
    // Send miner_token (primary) or wallet_address (legacy)
    // machine_id identifies this machine for multi-miner accounts (v3.12.0+)
    const authMsg = { type: 'auth' };
    if (this.walletAddress.startsWith('kz_')) {
      authMsg.miner_token = this.walletAddress;
    } else {
      authMsg.wallet_address = this.walletAddress;
    }
    if (this.machineId) authMsg.machine_id = this.machineId;
    if (this.minerName) authMsg.name = this.minerName;
    this.send(authMsg);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'auth_ok':
        this.minerId = msg.miner_id;
        console.log(`✅ Authenticated as miner #${this.minerId}`);
        break;

      case 'auth_error':
        console.error('Auth failed:', msg.message);
        break;

      case 'heartbeat_ok':
        // Heartbeat acknowledged
        break;

      case 'task':
        this.handleTask(msg);
        break;

      case 'error':
        console.error('Server error:', msg.message);
        // Backend forgot this connection (e.g. server restart or entry
        // replaced): re-authenticate so heartbeats/tasks flow again.
        // Guarded to avoid an auth loop (max once per 10s, only if we
        // had a valid session before).
        if (
          msg.message === 'Not authenticated' &&
          this.minerId &&
          this.ws && this.ws.readyState === WebSocket.OPEN &&
          Date.now() - this.lastReauthAt > 10000
        ) {
          this.lastReauthAt = Date.now();
          console.log('🔄 Re-authenticating...');
          this.authenticate();
        }
        break;
    }
  }

  async handleTask(msg) {
    const { task_id, prompt, model } = msg;
    console.log(`📥 Received task #${task_id} (${model})`);

    try {
      const result = await this.onTask(prompt, model);

      if (!result || !result.response) {
        throw new Error('Empty response from model');
      }

      this.send({
        type: 'task_result',
        task_id,
        response: result.response,
        tokens_used: result.eval_count || 0
      });

      console.log(`✅ Task #${task_id} completed (${result.eval_count || 0} tokens)`);

    } catch (err) {
      console.error(`❌ Task #${task_id} failed:`, err.message);
      this.send({
        type: 'task_result',
        task_id,
        error: err.message
      });
    }
  }

  sendHeartbeat(status = 'online', stats = {}) {
    const payload = {
      type: 'heartbeat',
      status,
      cpu_usage: stats.cpu_usage || 0,
      ram_usage: stats.ram_usage || 0,
      gpu_usage: stats.gpu_usage || 0,
      disk_usage: stats.disk_usage || 0,
      current_model: stats.current_model
    };
    console.log(`💓 Sending heartbeat (model: ${stats.current_model || '?'}, ws: ${this.ws ? this.ws.readyState : 'none'})`);
    this.send(payload);
  }

  requestTask() {
    this.send({ type: 'task_request' });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  startHeartbeat(minerService, defaultModel) {
    console.log(`💓 Heartbeat started (every 30s, model: ${defaultModel})`);
    this.heartbeatInterval = setInterval(() => {
      const stats = minerService ? minerService.getStats() : {};
      stats.current_model = defaultModel;
      this.sendHeartbeat('online', stats);
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  scheduleReconnect() {
    console.log(`Reconnecting in ${this.reconnectDelay / 1000}s...`);
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = MinerWebSocket;
