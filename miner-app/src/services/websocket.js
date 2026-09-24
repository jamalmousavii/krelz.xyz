const WebSocket = require('ws');

class MinerWebSocket {
  constructor(walletAddress, onTask) {
    this.walletAddress = walletAddress;
    this.onTask = onTask;
    this.lastReauthAt = 0;
    this.ws = null;
    this.minerId = null;
    this.connected = false;
    this.reconnectDelay = 5000;
    this.reconnectTimer = null;
    this.intentionalClose = false;
    this.authed = false;
    this.heartbeatInterval = null;
    this.heartbeatMinerService = null;
    this.heartbeatDefaultModel = null;
  }

  connect() {
    // Never stack sockets — close any previous connection first
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.intentionalClose = true;
      try {
        this.ws.removeAllListeners();
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch (e) {}
      this.ws = null;
    }

    this.intentionalClose = false;
    this.authed = false;
    const wsUrl = process.env.API_WS_URL || 'wss://krelz.xyz:443/ws';
    const ws = new WebSocket(wsUrl, {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
      servername: 'krelz.xyz',
    });
    this.ws = ws;

    ws.on('open', () => {
      if (this.ws !== ws) return;
      console.log('🔌 Connected to Krelz Network');
      this.connected = true;
      this.reconnectDelay = 5000;
      this.authenticate();
    });

    ws.on('message', (data) => {
      if (this.ws !== ws) return;
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error('Invalid WS message:', err.message);
      }
    });

    ws.on('close', () => {
      if (this.ws !== ws) return;
      console.log('🔌 Disconnected from Krelz Network');
      this.connected = false;
      this.authed = false;
      this.stopHeartbeat();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    ws.on('error', (err) => {
      if (this.ws !== ws) return;
      console.error('WebSocket error:', err.message);
    });
  }

  authenticate() {
    // Send miner_token (primary) or wallet_address (legacy).
    // v3.13.0+: each server-miner has its own unique token, and the token
    // IS the miner identity — no machine_id needed.
    const authMsg = { type: 'auth' };
    if (this.walletAddress.startsWith('kz_')) {
      authMsg.miner_token = this.walletAddress;
    } else {
      authMsg.wallet_address = this.walletAddress;
    }
    this.send(authMsg);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'auth_ok':
        this.minerId = msg.miner_id;
        this.authed = true;
        console.log(`✅ Authenticated as miner #${this.minerId}`);
        this.ensureHeartbeat();
        // Push model immediately so DB current_model updates without waiting 30s
        this.sendHeartbeat('online', { current_model: this.heartbeatDefaultModel });
        break;

      case 'auth_error':
        console.error('Auth failed:', msg.message);
        break;

      case 'heartbeat_ok':
        break;

      case 'task':
        this.handleTask(msg);
        break;

      case 'error':
        console.error('Server error:', msg.message);
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
        // "Replaced by newer connection" → close handler will reconnect once
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
    this.heartbeatMinerService = minerService;
    this.heartbeatDefaultModel = defaultModel;
    this.ensureHeartbeat();
  }

  ensureHeartbeat() {
    if (this.heartbeatInterval) return;
    if (!this.heartbeatMinerService && !this.heartbeatDefaultModel) return;
    console.log(`💓 Heartbeat started (every 30s, model: ${this.heartbeatDefaultModel})`);
    this.heartbeatInterval = setInterval(() => {
      const stats = this.heartbeatMinerService
        ? this.heartbeatMinerService.getStats()
        : {};
      stats.current_model = this.heartbeatDefaultModel;
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
    if (this.reconnectTimer) return;
    console.log(`Reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.connected = false;
    this.authed = false;
  }
}

module.exports = MinerWebSocket;
