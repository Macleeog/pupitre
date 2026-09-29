const { app, BrowserWindow, dialog } = require("electron");
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

  const window = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 390,
    minHeight: 640,
    title: "Pupitre",
    backgroundColor: "#101614",
    autoHideMenuBar: true,
  });
  await window.loadURL(`http://127.0.0.1:${PORT}/`);
  window.on("closed", shutdown);
});

app.on("window-all-closed", () => {
  app.quit();
});
