const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pupitre", {
  onFarmCommand(handler) {
    const listener = (_event, command) => handler(command);
    ipcRenderer.on("farm-command", listener);
    return () => ipcRenderer.removeListener("farm-command", listener);
  },
  overlayMoveBy(dx, dy) {
    ipcRenderer.send("overlay:move-by", dx, dy);
  },
  overlayDragEnd() {
    ipcRenderer.send("overlay:drag-end");
  },
});
