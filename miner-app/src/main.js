const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const OllamaService = require('./services/ollama');
const MinerService = require('./services/miner');
const ApiService = require('./services/api');
const MinerWebSocket = require('./services/websocket');

let mainWindow;
let tray;
let ollamaService;
let minerService;
let apiService;
let wsClient;

// Read config
let config = { models: 'llama3.1:8b', default_model: 'llama3.1:8b', miner_token: '', machine_id: '', name: '' };
const configPath = path.join(__dirname, '../config.json');
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Krelz Miner',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Start Mining', click: () => startMining() },
    { label: 'Stop Mining', click: () => stopMining() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Krelz Miner');
  tray.setContextMenu(contextMenu);
}

async function startMining() {
  try {
    await ollamaService.start();
    await minerService.start();
    wsClient.connect();
    mainWindow.webContents.send('mining-started');
  } catch (error) {
    console.error('Error starting mining:', error);
  }
}

async function stopMining() {
  try {
    await minerService.stop();
    await ollamaService.stop();
    wsClient.disconnect();
    mainWindow.webContents.send('mining-stopped');
  } catch (error) {
    console.error('Error stopping mining:', error);
  }
}

app.whenReady().then(() => {
  ollamaService = new OllamaService();
  minerService = new MinerService();
  apiService = new ApiService();

  wsClient = new MinerWebSocket(
    config.miner_token || process.env.WALLET_ADDRESS || '',
    async (prompt, model) => {
      ollamaService.setModel(model);
      const result = await ollamaService.generate(prompt, model);
      return result;
    },
    { machineId: config.machine_id || null, minerName: config.name || null }
  );

  createWindow();
  createTray();

  ipcMain.handle('start-mining', startMining);
  ipcMain.handle('stop-mining', stopMining);
  ipcMain.handle('get-stats', () => minerService.getStats());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
