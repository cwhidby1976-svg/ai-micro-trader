const { ipcMain, BrowserWindow } = require('electron');

const PORT = process.env.PORT || '3000';
const API_BASE = `http://127.0.0.1:${PORT}`;
const ALLOWED_PATHS = new Set([
  '/api/license/activate',
  '/api/license/verify',
  '/api/license/deactivate',
]);

function isTrustedOrigin(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith(`http://127.0.0.1:${PORT}`) || url.startsWith('http://localhost:');
}

function registerLicensingBridge() {
  ipcMain.handle('licensing:request', async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const frameUrl = event.senderFrame?.url || '';
    if (!win || win.isDestroyed() || event.senderFrame !== win.webContents.mainFrame || !isTrustedOrigin(frameUrl)) {
      throw new Error('Unauthorized application origin');
    }
    if (!request || typeof request !== 'object' || !ALLOWED_PATHS.has(request.path)) {
      throw new Error('API endpoint not permitted');
    }
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
      throw new Error('Invalid request body');
    }
    const serialized = JSON.stringify(request.body);
    if (serialized.length > 16384) throw new Error('Request too large');
    const response = await fetch(API_BASE + request.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return { status: response.status, ok: response.ok, data };
  });
}

module.exports = { registerLicensingBridge };
