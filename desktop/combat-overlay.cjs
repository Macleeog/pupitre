const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const combatObserver = require('./game-net/combat-observer.cjs');

let overlayWindow = null;
let mainWindow = null;
let lastSnapshot = null;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setFocusable(false);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadURL('http://localhost:5173/overlay');
}

function setupCombatIpc() {
  ipcMain.on('combat-snapshot', (_, snapshot) => {
    lastSnapshot = snapshot;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('combat-update', snapshot);
    }
  });

  ipcMain.handle('get-combat-snapshot', () => lastSnapshot);
}

function pushCombatUpdate() {
  const snapshot = combatObserver.getState();
  lastSnapshot = snapshot;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('combat-update', snapshot);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('combat-update', snapshot);
  }
}

function hookMessageStream() {
  const originalHandle = combatObserver.handleMessage;
  combatObserver.handleMessage = function(type, direction, kind, fields, at) {
    const result = originalHandle(type, direction, kind, fields, at);
    if (result) {
      pushCombatUpdate();
    }
    return result;
  };
}

module.exports = {
  createOverlayWindow,
  setupCombatIpc,
  pushCombatUpdate,
  hookMessageStream,
  setMainWindow(w) { mainWindow = w; },
};
