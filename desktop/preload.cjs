const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pupitre", {
  onFarmCommand(handler) {
    const listener = (_event, command) => handler(command);
    ipcRenderer.on("farm-command", listener);
    return () => ipcRenderer.removeListener("farm-command", listener);
  },
<<<<<<< HEAD
  overlayMoveBy(dx, dy) {
    ipcRenderer.send("overlay:move-by", dx, dy);
  },
  overlayDragEnd() {
    ipcRenderer.send("overlay:drag-end");
=======
  onGameMessage(handler) {
    const listener = (_event, message) => handler(message);
    ipcRenderer.on("game-message", listener);
    return () => ipcRenderer.removeListener("game-message", listener);
>>>>>>> origin/feature/passive-sniffer
  },
});
