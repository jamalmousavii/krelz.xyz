const fs = require('fs');
const path = require('path');
const OllamaService = require('./services/ollama');
const MinerService = require('./services/miner');
const MinerWebSocket = require('./services/websocket');

const configPath = path.join(__dirname, '../config.json');
let config = { models: 'llama3.1:8b', default_model: 'llama3.1:8b', miner_token: '', machine_id: '', name: '' };
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Failed to read config.json:', e.message);
  }
}

if (!config.miner_token) {
  console.error('❌ No miner_token in config.json. Run the install script first.');
  process.exit(1);
}

console.log('🚀 Krelz Miner starting...');
console.log(`   Token: ${config.miner_token.slice(0, 10)}...`);
console.log(`   Model: ${config.default_model}`);

const ollama = new OllamaService(config.default_model);
const miner = new MinerService();

const ws = new MinerWebSocket(
  config.miner_token,
  async (prompt, model) => {
    ollama.setModel(model);
    const result = await ollama.generate(prompt, model);
    return result;
  }
);

async function start() {
  try {
    console.log('📦 Starting Ollama...');
    await ollama.start();
    console.log('✅ Ollama ready');

    console.log('⛏️  Starting miner service...');
    await miner.start();

    console.log('🔌 Connecting to Krelz Network...');
    ws.startHeartbeat(miner, config.default_model);
    ws.connect();

    console.log('✅ Miner is running! Press Ctrl+C to stop.');
  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping miner...');
  ws.disconnect();
  miner.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ws.disconnect();
  miner.stop();
  process.exit(0);
});

start();
