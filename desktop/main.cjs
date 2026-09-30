const { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, screen, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { GameNetReader } = require("./game-net/reader.cjs");
const { lookupMapCoords, validCoords } = require("./game-net/map-coords.cjs");
const { watchForUpdates } = require("./updates.cjs");

const PORT = 47321;
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

function webPreferences(overrides = {}) {
  return {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    ...overrides,
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
  const next = { x: Math.round(x), y: Math.round(y), ...overlaySize(overlay) };
  const current = overlay.getBounds();
  if (current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height) return;
  // A window whose minimum size equals its maximum ignores setBounds position changes on Windows.
  // Unlock for the move, then lock again so display scaling cannot grow the bandeau.
  const { width, height } = overlaySize(overlay);
  overlay.pupitreMoving = true;
  try {
    overlay.setMinimumSize(1, 1);
    overlay.setMaximumSize(4000, 4000);
    overlay.setBounds(next);
    overlay.setMinimumSize(width, height);
    overlay.setMaximumSize(width, height);
  } finally {
    overlay.pupitreMoving = false;
  }
}

function windowHandle(win) {
  const buf = win.getNativeWindowHandle();
  const value = buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
  if (value === 0n) return 0n;
  return value > 9223372036854775807n ? value - 18446744073709551616n : value;
}

// Windows only lets the foreground process move the foreground. The bandeau is foreground while
// it is being dragged, so this attaches to that thread and hands the keyboard back to Dofus.
function focusGame(hwnd) {
  if (process.platform !== "win32" || typeof hwnd !== "bigint" || hwnd === 0n) return;
  const signed = hwnd > 9223372036854775807n ? hwnd - 18446744073709551616n : hwnd;
  if (signed < -9223372036854775808n || signed > 9223372036854775807n) return;
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PupitreFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  public static void Focus(long raw) {
    IntPtr target = new IntPtr(raw);
    IntPtr foreground = GetForegroundWindow();
    uint pid;
    uint foreThread = GetWindowThreadProcessId(foreground, out pid);
    uint appThread = GetCurrentThreadId();
    if (foreThread != 0 && foreThread != appThread) AttachThreadInput(foreThread, appThread, true);
    SetForegroundWindow(target);
    if (foreThread != 0 && foreThread != appThread) AttachThreadInput(foreThread, appThread, false);
  }
}
'@
[PupitreFocus]::Focus(${signed.toString()})
`;
  spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    { windowsHide: true, stdio: "ignore" },
  );
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
  const state = { game: null, gameHwnd: 0n, placement: loadPlacement(), dragging: false, hiddenByUser: false };
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

  ipcMain.on("overlay:drag-start", (event) => {
    if (event.sender !== overlay.webContents) return;
    state.dragging = true;
  });

  ipcMain.on("overlay:move-by", (event, dx, dy) => {
    if (event.sender !== overlay.webContents || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    state.dragging = true;
    const [x, y] = overlay.getPosition();
    moveOverlay(overlay, x + dx, y + dy);
  });

  const releaseToGame = () => {
    if (!overlay.isDestroyed()) overlay.blur();
    focusGame(state.gameHwnd);
  };

  ipcMain.on("overlay:drag-end", (event) => {
    if (event.sender !== overlay.webContents) return;
    const wasDragging = state.dragging;
    state.dragging = false;
    if (wasDragging && state.game) {
      const bounds = overlay.getBounds();
      state.placement = {
        right: Math.round(state.game.x + state.game.width - bounds.x - bounds.width),
        top: Math.round(bounds.y - state.game.y),
        size: overlay.pupitreSize,
      };
      writeJson("overlay.json", state.placement);
      place();
    }
    releaseToGame();
  });

  if (process.platform !== "win32") {
    overlay.once("ready-to-show", () => {
      if (!state.hiddenByUser) overlay.showInactive();
    });
    return { watcher: null, toggle, resize, gameBounds: () => state.game, gameHandle: () => state.gameHwnd };
  }

  // The script sits inside app.asar in the packaged exe, where powershell.exe cannot open it by path.
  const script = fs
    .readFileSync(path.join(__dirname, "follow-dofus.ps1"), "utf8")
    .replaceAll("__OVERLAY_HWND__", windowHandle(overlay).toString());
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
    if (parts.length < 5 || parts.slice(0, 5).some((part) => !Number.isFinite(part))) return;
    const [left, top, right, bottom, front] = parts;
    if (parts.length >= 6 && Number.isFinite(parts[5])) state.gameHwnd = BigInt(Math.trunc(parts[5]));
    state.game = screen.screenToDipRect(null, {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    });
    if (state.dragging) return;
    place();
    // The avis card is its own window. While it is up, a click on its cross must not
    // make the bandeau think Dofus left the foreground and hide itself.
    const toastUp = wantedToast && !wantedToast.isDestroyed() && wantedToast.isVisible();
    if (front === 1 || toastUp) {
      if (!state.hiddenByUser && !overlay.isVisible()) overlay.showInactive();
    } else {
      overlay.hide();
    }
  });
  return { watcher: child, toggle, resize, gameBounds: () => state.game, gameHandle: () => state.gameHwnd };
}

// Passive, read-only: tshark (Wireshark + Npcap) copies the game's packets; nothing is
// injected, redirected or sent anywhere.
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
      if (event.type === "wanted-absent") {
        clearTimeout(toastTimer);
        toastQueued = null;
        closeWantedToast();
      }
      if (event.type === "wanted-sighting" && reader.wantedNotices !== false) queueWantedToast(event);
    },
    cacheFile: path.join(app.getPath("userData"), "game-servers.json"),
    mapLookup: (mapId) => lookupMapCoords(mapId, { cacheFile: path.join(app.getPath("userData"), "map-coords.json") }),
    ownFighterIds: loadOwnFighters(),
    onOwnFighters: (ids) => writeJson("own-fighters.json", ids),
  });
  const fromDesk = (event) => event.sender === desk.webContents;
  ipcMain.handle("net:get-state", (event) => (fromDesk(event) ? reader.snapshot() : null));
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

const TOAST_W = 148;
const TOAST_H = 168;
const TOAST_GAP = 8;
let wantedToast = null;
let toastPlacement = null;
let toastShownAt = null;
let toastTimer = null;
let toastQueued = null;
let gameView = { bounds: () => null, handle: () => 0n };

function toastHeight(count) {
  return TOAST_H * count + TOAST_GAP * Math.max(0, count - 1);
}

function loadToastPlacement() {
  const saved = readJson("toast.json");
  if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return { x: Math.round(saved.x), y: Math.round(saved.y) };
  return null;
}

function wantedCards(monsters) {
  if (!Array.isArray(monsters)) return [];
  const cards = [];
  for (const monster of monsters) {
    if (cards.length >= 3) break;
    if (!monster || typeof monster.name !== "string" || !Number.isFinite(monster.id)) continue;
    const card = { id: monster.id, name: monster.name.slice(0, 48) };
    if (Number.isFinite(monster.gfxId) && monster.gfxId > 0) card.gfxId = monster.gfxId;
    cards.push(card);
  }
  return cards;
}

function placeWantedToast(win, count) {
  const width = TOAST_W;
  const height = toastHeight(count);
  const game = gameView.bounds();
  const area = screen.getPrimaryDisplay().workArea;
  const x = toastPlacement ? toastPlacement.x : Math.round(game ? game.x + 16 : area.x + 16);
  const y = toastPlacement ? toastPlacement.y : Math.round(game ? game.y + 16 : area.y + 16);
  win.setMinimumSize(1, 1);
  win.setMaximumSize(4000, 4000);
  win.setBounds({ x, y, width, height });
}

function moveWantedToastBy(dx, dy) {
  if (!wantedToast || wantedToast.isDestroyed()) return;
  const bounds = wantedToast.getBounds();
  const x = Math.round(bounds.x + dx);
  const y = Math.round(bounds.y + dy);
  wantedToast.setMinimumSize(1, 1);
  wantedToast.setMaximumSize(4000, 4000);
  wantedToast.setBounds({ x, y, width: bounds.width, height: bounds.height });
  toastPlacement = { x, y };
}

function closeWantedToast(options = {}) {
  const win = wantedToast;
  if (!win || win.isDestroyed()) return;
  const focused = win.isFocused();
  wantedToast = null;
  win.close();
  if (focused && options.focus !== false) focusGame(gameView.handle());
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
  const url = `http://127.0.0.1:${PORT}/avis?m=${encodeURIComponent(JSON.stringify({ cards, coords }))}`;
  if (!wantedToast || wantedToast.isDestroyed()) {
    const win = new BrowserWindow({
      width: TOAST_W,
      height: toastHeight(cards.length),
      frame: false,
      transparent: true,
      thickFrame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      show: false,
      focusable: true,
      backgroundColor: "#00000000",
      webPreferences: webPreferences({ backgroundThrottling: false }),
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

// Coordinates arrive a moment after the sighting. Wait briefly so the card opens once, with /travel.
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
  moveWantedToastBy(dx, dy);
});

ipcMain.on("toast:drag-end", (event) => {
  if (!wantedToast || wantedToast.isDestroyed() || event.sender !== wantedToast.webContents) return;
  if (toastPlacement) writeJson("toast.json", toastPlacement);
  if (wantedToast.isFocused()) {
    wantedToast.blur();
    focusGame(gameView.handle());
  }
});

ipcMain.on("toast:copy", (_event, text) => {
  if (typeof text !== "string" || !/^\/travel -?\d{1,4},-?\d{1,4}$/.test(text)) return;
  clipboard.writeText(text);
});

app.whenReady().then(async () => {
  if (process.platform === "win32") app.setAppUserModelId("app.pupitre.desk");
  toastPlacement = loadToastPlacement();
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
    backgroundColor: "#1a120c",
    show: false,
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  // Layered on purpose: the card opacity is a slider, and partial alpha needs a transparent window.
  // thickFrame off skips the extra frame shadow. The clock keeps real time while Dofus is in front;
  // the desk window stays throttled. focusable so a click reaches the page (an unfocusable window
  // drops pointer events on Windows). The keyboard is handed back to Dofus when the pointer goes up.
  const overlay = new BrowserWindow({
    ...OVERLAY_SIZES.compact,
    frame: false,
    transparent: true,
    thickFrame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    backgroundColor: "#00000000",
    webPreferences: webPreferences({ backgroundThrottling: false }),
  });
  overlay.on("resize", () => {
    if (overlay.pupitreMoving) return;
    const [width, height] = overlay.getSize();
    const size = overlaySize(overlay);
    if (width === size.width && height === size.height) return;
    const [x, y] = overlay.getPosition();
    moveOverlay(overlay, x, y);
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const { watcher, toggle, resize, gameBounds, gameHandle } = followDofus(overlay);
  gameView = { bounds: gameBounds, handle: gameHandle };
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

  desk.once("ready-to-show", () => desk.show());
  network = readGameNetwork(desk);
  watchForUpdates(desk);
  await Promise.all([desk.loadURL(`http://127.0.0.1:${PORT}/`), overlay.loadURL(`http://127.0.0.1:${PORT}/overlay`)]);
  desk.on("closed", () => {
    closeWantedToast({ focus: false });
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
