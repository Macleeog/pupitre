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
  copyTravel(command) {
    ipcRenderer.send("clipboard:travel", command);
  },
  harebourg: {
    setEnabled: (enabled) => ipcRenderer.send("harebourg:enabled", enabled),
  },
  toast: {
    setCount: (count) => ipcRenderer.send("toast:count", count),
    moveBy: (dx, dy) => ipcRenderer.send("toast:move-by", dx, dy),
    dragEnd: () => ipcRenderer.send("toast:drag-end"),
    onCoords(handler) {
      const listener = (_event, coords) => handler(coords);
      ipcRenderer.on("toast:coords", listener);
      return () => ipcRenderer.removeListener("toast:coords", listener);
    },
  },
  shortcuts: {
    set: (map) => ipcRenderer.invoke("shortcuts:set", map),
  },
  overlaySize: {
    get: () => ipcRenderer.invoke("overlay:get-size"),
    set: (size) => ipcRenderer.send("overlay:set-size", size),
  },
  updates: {
    getState: () => ipcRenderer.invoke("update:get-state"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.send("update:install"),
    onState(handler) {
      const listener = (_event, state) => handler(state);
      ipcRenderer.on("update:state", listener);
      return () => ipcRenderer.removeListener("update:state", listener);
    },
  },
  net: {
    getState: () => ipcRenderer.invoke("net:get-state"),
    startCapture: () => ipcRenderer.invoke("net:capture-start"),
    stopCapture: () => ipcRenderer.invoke("net:capture-stop"),
    restart: () => ipcRenderer.invoke("net:restart"),
    openFolder: () => ipcRenderer.invoke("net:open-folder"),
    forgetOwn: () => ipcRenderer.invoke("net:forget-own"),
    setActive: (active) => ipcRenderer.send("net:set-active", active),
    setWantedNotices: (enabled) => ipcRenderer.send("net:set-wanted-notices", enabled),
    setArchiNotices: (enabled) => ipcRenderer.send("net:set-archi-notices", enabled),
    onState(handler) {
      const listener = (_event, state) => handler(state);
      ipcRenderer.on("net:state", listener);
      return () => ipcRenderer.removeListener("net:state", listener);
    },
    onGameEvent(handler) {
      const listener = (_event, gameEvent) => handler(gameEvent);
      ipcRenderer.on("game-event", listener);
      return () => ipcRenderer.removeListener("game-event", listener);
    },
  },
});
