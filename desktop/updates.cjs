const { app, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const RELEASES = "https://github.com/Macleeog/pupitre/releases";

// Updates come from the GitHub releases (latest.yml, written by electron-builder). Only a copy
// installed by the setup can replace itself; an extracted zip is told to install once.
function pupitreVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    if (typeof pkg.version === "string" && pkg.version) return pkg.version;
  } catch {
    // A packaged copy still exposes it through Electron.
  }
  return app.getVersion();
}

function watchForUpdates(desk) {
  let state = { status: "idle", version: pupitreVersion(), available: null, progress: 0, detail: "" };
  const set = (patch) => {
    state = { ...state, ...patch };
    if (!desk.isDestroyed()) desk.webContents.send("update:state", state);
  };
  const fromDesk = (event) => event.sender === desk.webContents;

  const installed =
    app.isPackaged && process.platform === "win32" && fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
  let updater = null;

  if (!installed) {
    state.status = app.isPackaged ? "manual" : "dev";
    state.detail = RELEASES;
  } else {
    ({ autoUpdater: updater } = require("electron-updater"));
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.logger = null;
    updater.on("checking-for-update", () => set({ status: "checking", detail: "" }));
    updater.on("update-not-available", () => set({ status: "up-to-date", detail: "" }));
    updater.on("update-available", (info) => set({ status: "downloading", available: info.version, progress: 0 }));
    updater.on("download-progress", (progress) => set({ status: "downloading", progress: Math.round(progress.percent) }));
    updater.on("update-downloaded", (info) => set({ status: "ready", available: info.version, progress: 100 }));
    updater.on("error", (error) => set({ status: "error", detail: readableUpdateError(error) }));
    const check = () => updater.checkForUpdates().catch(() => {});
    setTimeout(check, 8000);
    setInterval(check, CHECK_EVERY_MS);
  }

  ipcMain.handle("update:get-state", (event) => (fromDesk(event) ? state : null));
  ipcMain.handle("update:check", async (event) => {
    if (!fromDesk(event) || !updater) return state;
    await updater.checkForUpdates().catch(() => {});
    return state;
  });
  ipcMain.on("update:install", (event) => {
    if (fromDesk(event) && updater && state.status === "ready") updater.quitAndInstall(true, true);
  });
}

// A private repo answers 404 on the releases feed. The raw message includes headers.
function readableUpdateError(error) {
  const message = String(error?.message ?? error);
  if (/404/.test(message)) {
    return "La page des versions ne répond pas pour le moment. Réessaie plus tard.";
  }
  return message.replace(/\s+/g, " ").slice(0, 180);
}

module.exports = { watchForUpdates };
