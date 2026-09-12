const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const OllamaService = require('./services/ollama');
const MinerService = require('./services/miner');
const BlockchainService = require('./services/blockchain');
const ApiService = require('./services/api');

let mainWindow;
let tray;
let ollamaService;
let minerService;
let blockchainService;
let apiService;

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
    mainWindow.webContents.send('mining-started');
  } catch (error) {
    console.error('Error starting mining:', error);
  }
}

async function stopMining() {
  try {
    await minerService.stop();
    await ollamaService.stop();
    mainWindow.webContents.send('mining-stopped');
  } catch (error) {
    console.error('Error stopping mining:', error);
  }
}

app.whenReady().then(() => {
  ollamaService = new OllamaService();
  minerService = new MinerService();
  blockchainService = new BlockchainService();
  apiService = new ApiService();

  createWindow();
  createTray();

  ipcMain.handle('start-mining', startMining);
  ipcMain.handle('stop-mining', stopMining);
  ipcMain.handle('get-stats', () => minerService.getStats());
  ipcMain.handle('connect-wallet', () => blockchainService.connect());
  ipcMain.handle('get-balance', () => blockchainService.getBalance());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
