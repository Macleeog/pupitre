const { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, screen, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { GameNetReader } = require("./game-net/reader.cjs");
const { lookupMapCoords, validCoords } = require("./game-net/map-coords.cjs");
const { watchForUpdates } = require("./updates.cjs");

const PORT = 47321;
const TOAST_W = 168;
const TOAST_H = 176;
const TOAST_GAP = 8;
let deskWindow = null;
let harebourgLayer = null;
let harebourgEnabled = true;
let wantedToast = null;
let toastPlacement = null;
let toastShownAt = null;
let toastTimer = null;
let toastQueued = null;
const DEFAULT_PLACEMENT = { right: 12, top: 48 };
const OVERLAY_SIZES = {
  compact: { width: 300, height: 150 },
  large: { width: 380, height: 210 },
};
const DEFAULT_SHORTCUTS = {
  overlay: "CommandOrControl+Shift+F9",
  start: "CommandOrControl+Shift+F6",
  pause: "CommandOrControl+Shift+F7",
  stop: "CommandOrControl+Shift+F8",
  reset: "CommandOrControl+Shift+F10",
  combat: "CommandOrControl+Shift+F5",
};

function pupitreVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    if (typeof pkg.version === "string" && pkg.version) return pkg.version;
  } catch {
    // The window title falls back to the name alone.
  }
  return "";
}

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
    spellcheck: false,
  };
}

function sendFarm(command, overlay, desk) {
  const target = overlay && !overlay.isDestroyed() ? overlay : desk;
  if (target && !target.isDestroyed()) target.webContents.send("farm-command", command);
}

function userFile(name) {
  return path.join(app.getPath("userData"), name);
}

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(userFile(name), "utf8"));
  } catch {
    return null;
  }
}

function writeJson(name, value) {
  try {
    fs.writeFileSync(userFile(name), JSON.stringify(value));
  } catch {
    // These files are conveniences; losing one must never break the app.
  }
}

function loadPlacement() {
  const saved = readJson("overlay.json");
  const size = OVERLAY_SIZES[saved?.size] ? saved.size : "compact";
  if (Number.isFinite(saved?.right) && Number.isFinite(saved?.top)) return { right: saved.right, top: saved.top, size };
  return { ...DEFAULT_PLACEMENT, size };
}

function loadOwnFighters() {
  const saved = readJson("own-fighters.json");
  return Array.isArray(saved) ? saved.filter((id) => typeof id === "string" && /^\d{1,20}$/.test(id)) : [];
}

function cleanShortcuts(map) {
  const clean = {};
  for (const [action, fallback] of Object.entries(DEFAULT_SHORTCUTS)) {
    const value = map && typeof map === "object" ? map[action] : undefined;
    clean[action] = typeof value === "string" ? value.slice(0, 80) : fallback;
  }
  return clean;
}

function loadShortcuts() {
  return cleanShortcuts(readJson("shortcuts.json"));
}

function registerShortcuts(map, run) {
  globalShortcut.unregisterAll();
  const status = {};
  const taken = new Set();
  for (const [action, accelerator] of Object.entries(map)) {
    if (!accelerator) {
      status[action] = "empty";
      continue;
    }
    const key = accelerator.toLowerCase();
    if (taken.has(key)) {
      status[action] = "duplicate";
      continue;
    }
    taken.add(key);
    let ok = false;
    try {
      ok = globalShortcut.register(accelerator, () => run(action));
    } catch {
      ok = false;
    }
    status[action] = ok ? "ok" : "failed";
  }
  return status;
}

// Windows drifts the size up on every setPosition when display scaling isn't 100%, so the
// overlay is always moved with explicit bounds at its chosen fixed size.
function overlaySize(overlay) {
  return OVERLAY_SIZES[overlay.pupitreSize] ?? OVERLAY_SIZES.compact;
}

function moveOverlay(overlay, x, y) {
  overlay.setBounds({ x: Math.round(x), y: Math.round(y), ...overlaySize(overlay) });
}

function lockOverlaySize(overlay, size) {
  overlay.pupitreSize = OVERLAY_SIZES[size] ? size : "compact";
  const { width, height } = overlaySize(overlay);
  overlay.setMinimumSize(1, 1);
  overlay.setMaximumSize(4000, 4000);
  overlay.setSize(width, height);
  overlay.setMinimumSize(width, height);
  overlay.setMaximumSize(width, height);
}

function followDofus(overlay) {
  const state = { game: null, placement: loadPlacement(), dragging: false, hiddenByUser: false };
  lockOverlaySize(overlay, state.placement.size);

  const resize = (size) => {
    if (overlay.isDestroyed()) return;
    const [x, y] = overlay.getPosition();
    const before = overlaySize(overlay);
    lockOverlaySize(overlay, size);
    state.placement = { ...state.placement, size: overlay.pupitreSize };
    writeJson("overlay.json", state.placement);
    if (state.game) place();
    else moveOverlay(overlay, x + before.width - overlaySize(overlay).width, y);
  };

  const toggle = () => {
    if (overlay.isDestroyed()) return;
    state.hiddenByUser = !state.hiddenByUser;
    if (state.hiddenByUser) {
      overlay.hide();
    } else if (process.platform !== "win32" || state.game) {
      place();
      overlay.showInactive();
    }
  };

  const place = () => {
    if (!state.game || overlay.isDestroyed()) return;
    const { width, height } = overlaySize(overlay);
    const top = Math.min(Math.max(0, state.placement.top), Math.max(0, state.game.height - height));
    const right = Math.min(Math.max(0, state.placement.right), Math.max(0, state.game.width - width));
    moveOverlay(overlay, state.game.x + state.game.width - width - right, state.game.y + top);
  };

  ipcMain.on("overlay:move-by", (event, dx, dy) => {
    if (event.sender !== overlay.webContents || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    state.dragging = true;
    const [x, y] = overlay.getPosition();
    moveOverlay(overlay, x + dx, y + dy);
  });

  ipcMain.on("overlay:drag-end", (event) => {
    if (event.sender !== overlay.webContents) return;
    state.dragging = false;
    if (!state.game) return;
    const bounds = overlay.getBounds();
    state.placement = {
      right: Math.round(state.game.x + state.game.width - bounds.x - bounds.width),
      top: Math.round(bounds.y - state.game.y),
      size: overlay.pupitreSize,
    };
    writeJson("overlay.json", state.placement);
    place();
  });

  if (process.platform !== "win32") {
    overlay.once("ready-to-show", () => {
      if (!state.hiddenByUser) overlay.showInactive();
    });
    return { watcher: null, toggle, resize };
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
      if (!state.hiddenByUser && !overlay.isVisible()) overlay.showInactive();
    } else {
      overlay.hide();
    }
  });
  return { watcher: child, toggle, resize };
}

function pageBase() {
  return `http://127.0.0.1:${PORT}`;
}

function toastHeight(count) {
  return TOAST_H * count + TOAST_GAP * Math.max(0, count - 1);
}

function wantedCards(monsters) {
  if (!Array.isArray(monsters)) return [];
  const cards = [];
  for (const monster of monsters) {
    if (cards.length >= 3) break;
    if (!monster || typeof monster.name !== "string" || !Number.isFinite(monster.id)) continue;
    const card = { id: monster.id, name: monster.name.slice(0, 48) };
    if (Number.isFinite(monster.gfxId) && monster.gfxId > 0) card.gfxId = monster.gfxId;
    if (monster.kind === "archi") card.kind = "archi";
    cards.push(card);
  }
  return cards;
}

function placeWantedToast(win, count) {
  const area = screen.getPrimaryDisplay().workArea;
  const x = toastPlacement ? toastPlacement.x : Math.round(area.x + 16);
  const y = toastPlacement ? toastPlacement.y : Math.round(area.y + 16);
  win.setBounds({ x, y, width: TOAST_W, height: toastHeight(count) });
}

function closeWantedToast() {
  const win = wantedToast;
  if (!win || win.isDestroyed()) return;
  wantedToast = null;
  win.close();
}

function showWantedToast(event) {
  const cards = wantedCards(event?.monsters);
  const coords = validCoords(event?.coords);
  if (cards.length === 0) {
    closeWantedToast();
    return;
  }
  if (wantedToast && !wantedToast.isDestroyed() && toastShownAt === event.at) {
    if (coords) wantedToast.webContents.send("toast:coords", coords);
    return;
  }
  toastShownAt = event.at;
  const url = `${pageBase()}/avis?m=${encodeURIComponent(JSON.stringify({ cards, coords }))}`;
  if (!wantedToast || wantedToast.isDestroyed()) {
    const win = new BrowserWindow({
      width: TOAST_W,
      height: toastHeight(cards.length),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      show: false,
      focusable: true,
      backgroundColor: "#00000000",
      webPreferences: webPreferences(),
    });
    wantedToast = win;
    win.setAlwaysOnTop(true, "screen-saver");
    win.on("closed", () => {
      if (wantedToast === win) wantedToast = null;
    });
    placeWantedToast(win, cards.length);
    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) win.showInactive();
    });
    void win.loadURL(url);
    return;
  }
  placeWantedToast(wantedToast, cards.length);
  void wantedToast.loadURL(url);
  if (!wantedToast.isVisible()) wantedToast.showInactive();
}

function queueWantedToast(event) {
  if (event.coords) {
    clearTimeout(toastTimer);
    toastQueued = null;
    showWantedToast(event);
    return;
  }
  toastQueued = event;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastQueued) showWantedToast(toastQueued);
    toastQueued = null;
  }, 1500);
}

function closeHarebourgLayer() {
  const win = harebourgLayer;
  if (!win || win.isDestroyed()) return;
  harebourgLayer = null;
  win.close();
}

function ensureHarebourgLayer() {
  if (harebourgLayer && !harebourgLayer.isDestroyed()) return harebourgLayer;
  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    thickFrame: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: { ...webPreferences(), backgroundThrottling: false },
  });
  harebourgLayer = win;
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.on("closed", () => {
    if (harebourgLayer === win) harebourgLayer = null;
  });
  void win.loadURL(`${pageBase()}/marque`);
  return win;
}

function syncHarebourgLayer(event) {
  const rect = event?.dofusWindow;
  const draw = Boolean(
    harebourgEnabled && event?.active && event?.mark && rect && rect.width >= 80 && rect.height >= 80,
  );
  if (!draw) {
    if (harebourgLayer && !harebourgLayer.isDestroyed() && harebourgLayer.isVisible()) harebourgLayer.hide();
    return;
  }
  const win = ensureHarebourgLayer();
  let bounds = rect;
  try {
    bounds = screen.screenToDipRect(win, rect);
  } catch {
    bounds = rect;
  }
  win.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(80, Math.round(bounds.width)),
    height: Math.max(80, Math.round(bounds.height)),
  });
  win.setIgnoreMouseEvents(true);
  if (!win.isVisible()) win.showInactive();
}

function fromDesk(event) {
  return Boolean(deskWindow && !deskWindow.isDestroyed() && event.sender === deskWindow.webContents);
}

ipcMain.on("clipboard:travel", (_event, text) => {
  if (typeof text === "string" && /^\/travel -?\d{1,4},-?\d{1,4}$/.test(text)) clipboard.writeText(text);
});

ipcMain.on("harebourg:enabled", (event, enabled) => {
  if (!fromDesk(event) || typeof enabled !== "boolean") return;
  harebourgEnabled = enabled;
  if (!enabled && harebourgLayer && !harebourgLayer.isDestroyed()) harebourgLayer.hide();
});

ipcMain.on("toast:count", (event, count) => {
  if (!wantedToast || wantedToast.isDestroyed() || event.sender !== wantedToast.webContents) return;
  const next = Number(count);
  if (!Number.isInteger(next) || next <= 0) {
    closeWantedToast();
    return;
  }
  placeWantedToast(wantedToast, Math.min(3, next));
});

ipcMain.on("toast:move-by", (event, dx, dy) => {
  if (!wantedToast || wantedToast.isDestroyed() || event.sender !== wantedToast.webContents) return;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  const bounds = wantedToast.getBounds();
  wantedToast.setBounds({
    x: Math.round(bounds.x + dx),
    y: Math.round(bounds.y + dy),
    width: bounds.width,
    height: bounds.height,
  });
  toastPlacement = { x: Math.round(bounds.x + dx), y: Math.round(bounds.y + dy) };
});

ipcMain.on("toast:drag-end", (event) => {
  if (!wantedToast || wantedToast.isDestroyed() || event.sender !== wantedToast.webContents) return;
  if (toastPlacement) writeJson("toast.json", toastPlacement);
});

// Passive, read-only: tshark (Wireshark + Npcap) copies the game's packets; nothing is
// injected, redirected or sent anywhere. Fight loot stays on the desk so the farm overlay
// cannot count the same combat twice.
function readGameNetwork(desk) {
  const capturesDir = path.join(app.getPath("userData"), "packet-captures");
  const toDesk = (channel, payload) => {
    if (!desk.isDestroyed()) desk.webContents.send(channel, payload);
  };
  const reader = new GameNetReader({
    capturesDir,
    onState: (state) => toDesk("net:state", state),
    onEvent: (event) => {
      toDesk("game-event", event);
      if (harebourgLayer && !harebourgLayer.isDestroyed() && event?.type === "harebourg-state") {
        harebourgLayer.webContents.send("game-event", event);
      }
      if (event.type === "wanted-absent") {
        clearTimeout(toastTimer);
        toastQueued = null;
        closeWantedToast();
      }
      if (event.type === "wanted-sighting") queueWantedToast(event);
      if (event.type === "harebourg-state") syncHarebourgLayer(event);
    },
    cacheFile: path.join(app.getPath("userData"), "game-servers.json"),
    ownFighterIds: loadOwnFighters(),
    onOwnFighters: (ids) => writeJson("own-fighters.json", ids),
    mapLookup: (mapId) => lookupMapCoords(mapId, { cacheFile: path.join(app.getPath("userData"), "map-coords.json") }),
  });
  const fromDesk = (event) => event.sender === desk.webContents;
  ipcMain.handle("net:get-state", (event) => {
    const marque = harebourgLayer && !harebourgLayer.isDestroyed() && event.sender === harebourgLayer.webContents;
    return fromDesk(event) || marque ? reader.snapshot() : null;
  });
  ipcMain.handle("net:capture-start", (event) => (fromDesk(event) ? reader.startCapture() : null));
  ipcMain.handle("net:capture-stop", (event) => (fromDesk(event) ? reader.stopCapture() : null));
  ipcMain.handle("net:restart", async (event) => {
    if (!fromDesk(event)) return null;
    await reader.restart();
    return reader.snapshot();
  });
  ipcMain.on("net:set-active", (event, active) => {
    if (fromDesk(event) && typeof active === "boolean") reader.setActive(active);
  });
  ipcMain.on("net:set-wanted-notices", (event, enabled) => {
    if (fromDesk(event) && typeof enabled === "boolean") reader.wantedNotices = enabled;
  });
  ipcMain.on("net:set-archi-notices", (event, enabled) => {
    if (fromDesk(event) && typeof enabled === "boolean") reader.archiNotices = enabled;
  });
  ipcMain.handle("net:forget-own", (event) => {
    if (!fromDesk(event)) return null;
    reader.forgetOwnFighters();
    return reader.snapshot();
  });
  ipcMain.handle("net:open-folder", async (event) => {
    if (!fromDesk(event)) return;
    const file = reader.snapshot().capture.file;
    if (file && fs.existsSync(file)) {
      shell.showItemInFolder(file);
      return;
    }
    fs.mkdirSync(capturesDir, { recursive: true });
    await shell.openPath(capturesDir);
  });
  return reader;
}

// Starts while Electron itself is still booting, so the window is not waiting on a cold server.
app.commandLine.appendSwitch("disable-features", "SpareRendererForSitePerProcess");
const root = outputRoot();
const entry = path.join(root, "server", "index.mjs");
const logs = [];
const pushLog = (chunk) => {
  logs.push(String(chunk));
  if (logs.length > 30) logs.shift();
};
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
child.stdout.on("data", pushLog);
child.stderr.on("data", pushLog);
child.on("exit", (code) => {
  if (code && code !== 0) pushLog(`exit ${code}`);
});

app.whenReady().then(async () => {
  let network = null;
  const shutdown = () => {
    if (!child.killed) child.kill();
    network?.stop();
  };
  app.on("before-quit", shutdown);

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
    title: pupitreVersion() ? `Pupitre ${pupitreVersion()}` : "Pupitre",
    backgroundColor: "#121212",
    show: false,
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  const overlay = new BrowserWindow({
    ...OVERLAY_SIZES.compact,
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
  overlay.on("resize", () => {
    const [width, height] = overlay.getSize();
    const size = overlaySize(overlay);
    if (width === size.width && height === size.height) return;
    const [x, y] = overlay.getPosition();
    moveOverlay(overlay, x, y);
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const { watcher, toggle, resize } = followDofus(overlay);
  ipcMain.handle("overlay:get-size", (event) =>
    event.sender === desk.webContents || event.sender === overlay.webContents ? overlay.pupitreSize : null,
  );
  ipcMain.on("overlay:set-size", (event, size) => {
    if (event.sender === desk.webContents && typeof size === "string") resize(size);
  });
  const runShortcut = (action) => (action === "overlay" ? toggle() : sendFarm(action, overlay, desk));
  registerShortcuts(loadShortcuts(), runShortcut);
  ipcMain.handle("shortcuts:set", (event, map) => {
    if (event.sender !== desk.webContents) return null;
    const clean = cleanShortcuts(map);
    writeJson("shortcuts.json", clean);
    return registerShortcuts(clean, runShortcut);
  });

  deskWindow = desk;
  const savedToast = readJson("toast.json");
  if (Number.isFinite(savedToast?.x) && Number.isFinite(savedToast?.y)) {
    toastPlacement = { x: Math.round(savedToast.x), y: Math.round(savedToast.y) };
  }
  desk.once("ready-to-show", () => desk.show());
  network = readGameNetwork(desk);
  watchForUpdates(desk);
  await Promise.all([desk.loadURL(`http://127.0.0.1:${PORT}/`), overlay.loadURL(`http://127.0.0.1:${PORT}/overlay`)]);
  desk.on("closed", () => {
    deskWindow = null;
    closeHarebourgLayer();
    closeWantedToast();
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
