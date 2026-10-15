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