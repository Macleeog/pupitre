const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pupitre", {
  onFarmCommand(handler) {
    const listener = (_event, command) => handler(command);
    ipcRenderer.on("farm-command", listener);
    return () => ipcRenderer.removeListener("farm-command", listener);
  },
  onGameMessage(handler) {
    const listener = (_event, message) => handler(message);
    ipcRenderer.on("game-message", listener);
    return () => ipcRenderer.removeListener("game-message", listener);
  },
});
