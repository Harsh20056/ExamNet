const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, isolated secure marking API into the window object
contextBridge.exposeInMainWorld('secure', {
  setMarkingMode: (on) => {
    ipcRenderer.send('set-marking-mode', !!on);
  },
  onViolation: (callback) => {
    if (typeof callback !== 'function') return;
    const listener = (event, violation) => {
      callback(violation);
    };
    ipcRenderer.on('secure-violation', listener);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('secure-violation', listener);
    };
  },
  getVersion: () => {
    return '1.0.0';
  }
});

// Internal bridge helper for index.html / browser container UI
contextBridge.exposeInMainWorld('browserBridge', {
  getConfig: () => ipcRenderer.invoke('get-app-config'),
  onMarkingModeChange: (callback) => {
    const listener = (event, active) => callback(active);
    ipcRenderer.on('marking-mode-changed', listener);
    return () => ipcRenderer.removeListener('marking-mode-changed', listener);
  },
  onSecureViolation: (callback) => {
    const listener = (event, violation) => callback(violation);
    ipcRenderer.on('secure-violation', listener);
    return () => ipcRenderer.removeListener('secure-violation', listener);
  }
});
