const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const combatOverlay = require('./combat-overlay.cjs');

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL('http://localhost:5173');
  combatOverlay.setMainWindow(mainWindow);
}

app.whenReady().then(() => {
  createMainWindow();
  combatOverlay.createOverlayWindow();
  combatOverlay.setupCombatIpc();
  combatOverlay.hookMessageStream();
});
