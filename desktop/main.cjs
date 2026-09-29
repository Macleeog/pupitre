const { app, BrowserWindow, dialog, globalShortcut, screen } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const PORT = 47321;

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

function followDofus(overlay) {
  if (process.platform !== "win32") return null;
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "follow-dofus.ps1")],
    { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
  );
  let last = "";
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    const line = lines.at(-1);
    if (!line || line === "none" || line === last || overlay.isDestroyed()) return;
    const parts = line.split(",").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return;
    last = line;
    const [left, top, right, bottom] = parts;
    const dip = screen.screenToDipRect(overlay, {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    });
    const [width] = overlay.getSize();
    overlay.setPosition(Math.round(dip.x + dip.width - width - 12), Math.round(dip.y + 48));
  });
  return child;
}

// Capture reseau PASSIVE (lecture seule) : opt-in via PUPITRE_SNIFFER=1.
// Necessite Wireshark (tshark + Npcap). Relaie chaque message JSON aux fenetres.
function followTraffic(targets) {
  if (process.platform !== "win32" || process.env.PUPITRE_SNIFFER !== "1") return null;
  const child = spawn(
    process.execPath,
    [
      path.join(__dirname, "pupitre-sniffer.cjs"),
      "--iface",
      process.env.PUPITRE_IFACE || "Wi-Fi",
      "--port",
      process.env.PUPITRE_PORT || "5555",
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
  );
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      for (const win of targets) {
        if (win && !win.isDestroyed()) win.webContents.send("game-message", message);
      }
    }
  });
  child.on("error", () => {});
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

  let traffic = null;
  const shutdown = () => {
    if (!child.killed) child.kill();
    if (traffic && !traffic.killed) traffic.kill();
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
    backgroundColor: "#00000000",
    webPreferences: webPreferences(),
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  const watcher = followDofus(overlay);
  traffic = followTraffic([desk, overlay]);

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
