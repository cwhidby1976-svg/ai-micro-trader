const { contextBridge, ipcRenderer } = require('electron');
const ALLOWED_PATHS = new Set([
  '/api/license/activate',
  '/api/license/verify',
  '/api/license/deactivate'
]);
contextBridge.exposeInMainWorld('desktopLicensing', {
  request: (path, body) => {
    if (!ALLOWED_PATHS.has(path)) return Promise.reject(new Error('Endpoint not allowed'));
    return ipcRenderer.invoke('licensing:request', { path, body });
  }
});
contextBridge.exposeInMainWorld('desktopWallet', {
  openExternal: (url) => ipcRenderer.invoke('wallet:open-external', url),
  onDeeplink: (callback) => {
    const listener = (_event, url) => callback(url);
    ipcRenderer.on('wallet:deeplink', listener);
    return () => ipcRenderer.removeListener('wallet:deeplink', listener);
  }
});
