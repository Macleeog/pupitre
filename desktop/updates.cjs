const { app, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const RELEASES = "https://github.com/Macleeog/pupitre/releases";

// Updates come from the GitHub releases (latest.yml, written by electron-builder). Only a copy
// installed by the setup can replace itself; an extracted zip is told to install once.
function watchForUpdates(desk) {
  let state = { status: "idle", version: app.getVersion(), available: null, progress: 0, detail: "" };
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
    updater.on("error", (error) => set({ status: "error", detail: String(error?.message ?? error).slice(0, 300) }));
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

module.exports = { watchForUpdates };
