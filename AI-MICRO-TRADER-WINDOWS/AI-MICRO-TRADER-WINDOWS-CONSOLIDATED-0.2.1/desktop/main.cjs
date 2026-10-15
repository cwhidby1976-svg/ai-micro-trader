const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');
const { registerLicensingBridge } = require('./licensing-bridge.cjs');
app.whenReady().then(() => {
  registerLicensingBridge();
  const win = new BrowserWindow({
    width: 1450, height: 900, minWidth: 1050, minHeight: 700,
    title: 'AI Micro Trader - Windows Test 0.2.1',
    icon: path.join(__dirname, 'assets', 'windows-icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: true, preload: path.join(__dirname, 'preload.cjs') }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  win.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (isMainFrame) dialog.showErrorBox('AI Micro Trader load error', `${code}: ${desc}\n${url}`);
  });
  win.loadFile(path.join(__dirname, 'dist', 'index.html')).catch(err => dialog.showErrorBox('AI Micro Trader startup error', String(err)));
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

