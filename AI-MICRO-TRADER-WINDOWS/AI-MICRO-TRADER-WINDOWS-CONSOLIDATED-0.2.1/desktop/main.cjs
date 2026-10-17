const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { registerLicensingBridge } = require('./licensing-bridge.cjs');

const PORT = process.env.PORT || '3000';
const LOCAL_ORIGIN = `http://127.0.0.1:${PORT}`;
let engineProcess = null;

function startLocalEngine() {
  const serverJs = path.join(__dirname, 'local-server.cjs');
  const distPath = path.join(__dirname, 'dist');
  const dataDir = path.join(app.getPath('userData'), 'data');
  engineProcess = spawn(process.execPath, [serverJs], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT,
      HOST: process.env.HOST || '0.0.0.0',
      AMT_DATA_DIR: dataDir,
      AMT_DIST_PATH: distPath,
      AMT_ENGINE_ROOT: __dirname,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  engineProcess.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  engineProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  engineProcess.on('exit', (code) => {
    if (code && code !== 0) {
      dialog.showErrorBox('AI Micro Trader local engine stopped', `The local API process exited with code ${code}.`);
    }
  });
}

async function waitForEngine() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${LOCAL_ORIGIN}/api/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Local engine did not start at ${LOCAL_ORIGIN}`);
}

function stopLocalEngine() {
  if (engineProcess && !engineProcess.killed) {
    engineProcess.kill();
    engineProcess = null;
  }
}

app.whenReady().then(async () => {
  registerLicensingBridge();
  try {
    startLocalEngine();
    await waitForEngine();
  } catch (err) {
    dialog.showErrorBox('AI Micro Trader startup error', String(err));
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1450,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    title: 'AI Micro Trader',
    icon: path.join(__dirname, 'assets', 'windows-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith(LOCAL_ORIGIN)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith(LOCAL_ORIGIN) || url.startsWith('http://localhost:');
    if (!allowed) event.preventDefault();
  });
  win.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (isMainFrame) dialog.showErrorBox('AI Micro Trader load error', `${code}: ${desc}\n${url}`);
  });
  await win.loadURL(LOCAL_ORIGIN);
});

app.on('before-quit', () => stopLocalEngine());
app.on('window-all-closed', () => {
  stopLocalEngine();
  if (process.platform !== 'darwin') app.quit();
});
