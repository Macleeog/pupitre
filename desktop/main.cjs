const { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = 47321;
const DEFAULT_PLACEMENT = { right: 12, top: 48 };

function outputRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "output");
  return path.join(__dirname, "..", ".output");
}

function waitForServer() {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ hostname: "127.0.0.1", port: PORT, path: "/" }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > 25000) reject(new Error("Le serveur Pupitre n'a pas démarré."));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function webPreferences() {
  return {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function sendFarm(command, overlay, desk) {
  const target = overlay && !overlay.isDestroyed() ? overlay : desk;
  if (target && !target.isDestroyed()) target.webContents.send("farm-command", command);
}

function placementFile() {
  return path.join(app.getPath("userData"), "overlay.json");
}

function loadPlacement() {
  try {
    const saved = JSON.parse(fs.readFileSync(placementFile(), "utf8"));
    if (Number.isFinite(saved.right) && Number.isFinite(saved.top)) return { right: saved.right, top: saved.top };
  } catch {
    // First launch or unreadable file: fall back to the default corner.
  }
  return { ...DEFAULT_PLACEMENT };
}

function savePlacement(placement) {
  try {
    fs.writeFileSync(placementFile(), JSON.stringify(placement));
  } catch {
    // Placement is a convenience; losing it must not break the overlay.
  }
}

function followDofus(overlay) {
  const state = { game: null, placement: loadPlacement(), dragging: false };

  const place = () => {
    if (!state.game || overlay.isDestroyed()) return;
    const [width, height] = overlay.getSize();
    const top = Math.min(Math.max(0, state.placement.top), Math.max(0, state.game.height - height));
    const right = Math.min(Math.max(0, state.placement.right), Math.max(0, state.game.width - width));
    overlay.setPosition(
      Math.round(state.game.x + state.game.width - width - right),
      Math.round(state.game.y + top),
    );
  };

  ipcMain.on("overlay:move-by", (event, dx, dy) => {
    if (event.sender !== overlay.webContents || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    state.dragging = true;
    const [x, y] = overlay.getPosition();
    overlay.setPosition(Math.round(x + dx), Math.round(y + dy));
  });

  ipcMain.on("overlay:drag-end", (event) => {
    if (event.sender !== overlay.webContents) return;
    state.dragging = false;
    if (!state.game) return;
    const bounds = overlay.getBounds();
    state.placement = {
      right: Math.round(state.game.x + state.game.width - bounds.x - bounds.width),
      top: Math.round(bounds.y - state.game.y),
    };
    savePlacement(state.placement);
    place();
  });

  if (process.platform !== "win32") {
    overlay.once("ready-to-show", () => overlay.showInactive());
    return null;
  }

  // The script sits inside app.asar in the packaged exe, where powershell.exe cannot open it by path.
  const script = fs.readFileSync(path.join(__dirname, "follow-dofus.ps1"), "utf8");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
  );
  let last = "";
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    const line = lines.at(-1)?.trim();
    if (!line || line === last || overlay.isDestroyed()) return;
    last = line;
    if (line === "none") {
      state.game = null;
      if (!state.dragging) overlay.hide();
      return;
    }
    const parts = line.split(",").map((part) => Number(part));
    if (parts.length !== 5 || parts.some((part) => !Number.isFinite(part))) return;
    const [left, top, right, bottom, front] = parts;
    state.game = screen.screenToDipRect(null, {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    });
    if (state.dragging) return;
    place();
    if (front === 1) {
      if (!overlay.isVisible()) overlay.showInactive();
    } else {
      overlay.hide();
    }
  });
  return child;
}

app.whenReady().then(async () => {
  const root = outputRoot();
  const entry = path.join(root, "server", "index.mjs");
  const logs = [];
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOST: "127.0.0.1",
      PORT: String(PORT),
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(String(chunk)));
  child.stderr.on("data", (chunk) => logs.push(String(chunk)));

  const shutdown = () => {
    if (!child.killed) child.kill();
  };
  app.on("before-quit", shutdown);
  child.on("exit", (code) => {
    if (code && code !== 0) logs.push(`exit ${code}`);
  });

  try {
    await waitForServer();
  } catch (error) {
    dialog.showErrorBox(
      "Pupitre",
      `${error instanceof Error ? error.message : "Démarrage impossible."}\n\n${logs.join("").slice(-1200)}`,
    );
    app.quit();
    return;
  }

  const desk = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 390,
    minHeight: 640,
    title: "Pupitre",
    backgroundColor: "#1a120c",
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  const overlay = new BrowserWindow({
    width: 300,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    focusable: false,
    backgroundColor: "#00000000",
    webPreferences: webPreferences(),
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const watcher = followDofus(overlay);

  const shortcuts = [
    ["CommandOrControl+Shift+F6", "start"],
    ["CommandOrControl+Shift+F7", "pause"],
    ["CommandOrControl+Shift+F8", "stop"],
    ["CommandOrControl+Shift+F5", "combat"],
  ];
  for (const [accelerator, command] of shortcuts) {
    globalShortcut.register(accelerator, () => sendFarm(command, overlay, desk));
  }

  await desk.loadURL(`http://127.0.0.1:${PORT}/`);
  await overlay.loadURL(`http://127.0.0.1:${PORT}/overlay`);
  desk.on("closed", () => {
    if (watcher && !watcher.killed) watcher.kill();
    if (!overlay.isDestroyed()) overlay.close();
    shutdown();
    app.quit();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  app.quit();
});
