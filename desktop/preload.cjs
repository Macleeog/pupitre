const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pupitre', {
  onCombatUpdate(fn) {
    const handler = (_, snapshot) => fn(snapshot);
    ipcRenderer.on('combat-update', handler);
    return () => ipcRenderer.removeListener('combat-update', handler);
  },
  sendCombatSnapshot(snapshot) {
    ipcRenderer.send('combat-snapshot', snapshot);
  },
});
