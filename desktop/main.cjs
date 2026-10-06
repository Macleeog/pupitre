const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let overlayWindow;

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
}

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

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();

  let lastSnapshot = null;

  ipcMain.on('combat-snapshot', (_, snapshot) => {
    lastSnapshot = snapshot;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('combat-update', snapshot);
    }
  });

  ipcMain.handle('get-combat-snapshot', () => lastSnapshot);
});
