$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Project = 'C:\Users\Chris\Desktop\AI-MICRO-TRADER-DEMO-MANUAL-AUTOPILOT-UPDATE\AI-MICRO-TRADER-WINDOWS\AI-MICRO-TRADER-WINDOWS-CONSOLIDATED-0.2.1'
$Desktop = Join-Path $Project 'desktop'
$LicensePath = Join-Path $Project 'src\services\licensingService.ts'
$MainPath = Join-Path $Desktop 'main.cjs'
$BridgePath = Join-Path $Desktop 'licensing-bridge.cjs'
$PreloadPath = Join-Path $Desktop 'preload.cjs'
$PackagePath = Join-Path $Desktop 'package.json'
$BuildPath = Join-Path $Project 'BUILD-WINDOWS-TEST.ps1'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $Project "LICENSING-FINAL-BACKUP-$stamp"
$LogPath = Join-Path $Project "LICENSING-FINAL-RESULT-$stamp.txt"

function Require([bool]$ok, [string]$message) { if (-not $ok) { throw $message } }
function SaveUtf8([string]$path, [string]$content) { [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false)) }
function ReplaceOne([string]$source, [string]$pattern, [string]$replacement, [string]$label) {
  $count = [regex]::Matches($source, $pattern).Count
  Require ($count -eq 1) "$label expected exactly once, found $count. No patch applied."
  return [regex]::Replace($source, $pattern, $replacement)
}

try {
  foreach ($file in @($LicensePath,$MainPath,$BridgePath,$PreloadPath,$PackagePath,$BuildPath)) { Require (Test-Path -LiteralPath $file) "Missing file: $file" }
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  foreach ($file in @($LicensePath,$MainPath,$BridgePath,$PreloadPath,$PackagePath,$BuildPath)) {
    $relative = $file.Substring($Project.Length).TrimStart('\')
    $target = Join-Path $BackupDir $relative
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $file -Destination $target -Force
  }
  Write-Host "BACKUP CREATED: $BackupDir" -ForegroundColor Green

  $main = [System.IO.File]::ReadAllText($MainPath)
  Require ($main.Contains('registerLicensingBridge();')) 'main.cjs is not registering the licensing bridge'
  Require ($main.Contains("preload: path.join(__dirname, 'preload.cjs')")) 'main.cjs does not reference preload.cjs'
  foreach ($flag in @('nodeIntegration: false','contextIsolation: true','sandbox: true','webSecurity: true')) { Require ($main.Contains($flag)) "Electron security setting missing: $flag" }

  # Register only for the exact app window and its top-level HTML file.
  $bridge = @'
const { ipcMain, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// LOCAL TEST ONLY. Do not ship as the production licensing endpoint.
const API_BASE = 'http://127.0.0.1:3000';
const ALLOWED_PATHS = new Set([
  '/api/license/activate',
  '/api/license/verify',
  '/api/license/deactivate'
]);

function registerLicensingBridge() {
  ipcMain.handle('licensing:request', async (event, request) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const trustedUrl = pathToFileURL(path.join(__dirname, 'dist', 'index.html')).href;
    if (!win || win.isDestroyed() || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== trustedUrl) {
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
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    return { status: response.status, ok: response.ok, data };
  });
}

module.exports = { registerLicensingBridge };
'@
  $preload = @'
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
'@

  $code = [System.IO.File]::ReadAllText($LicensePath)
  # Ensure the two earlier conversions happened and haven't been duplicated.
  Require ([regex]::Matches($code, "licensingRequest\('/api/license/activate'").Count -eq 1) 'Expected exactly one converted activate call'
  Require ([regex]::Matches($code, "licensingRequest\('/api/license/verify'").Count -eq 1) 'Expected exactly one converted verify call'
  Require ($code.Contains('async function licensingRequest(')) 'Desktop request helper missing'

  # Extend helper's accepted endpoint type and preserve its web fallback.
  $code = ReplaceOne $code "endpoint: '/api/license/activate' \| '/api/license/verify'" "endpoint: '/api/license/activate' | '/api/license/verify' | '/api/license/deactivate'" 'helper endpoint union'

  $deactivatePattern = "(?s)await fetch\('/api/license/deactivate', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application/json' \},\s*body: JSON\.stringify\(\{(.*?)\}\),\s*\}\);"
  $code = ReplaceOne $code $deactivatePattern "await licensingRequest('/api/license/deactivate', {`$1});" 'deactivation request'

  # Fail closed when a license is past expiresAt, even if graceUntil is later.
  $offlineNeedle = '    const graceExpiry = new Date(this.state.graceUntil).getTime();'
  Require ($code.Contains($offlineNeedle)) 'Offline grace function changed; manual review required'
  $offlineReplacement = @'
    const licenseExpiry = new Date(this.state.expiresAt || '').getTime();
    if (!Number.isFinite(licenseExpiry) || Date.now() >= licenseExpiry) {
      this.state.status = 'EXPIRED';
      this.state.isOfflineGrace = false;
      this.state.errorMessage = 'License expired. Please renew or activate a valid key.';
      this.saveStoredLicense();
      this.notify();
      return;
    }
    const graceExpiry = new Date(this.state.graceUntil).getTime();
'@
  $code = $code.Replace($offlineNeedle, $offlineReplacement.TrimEnd("`r","`n"))
  # Avoid accepting invalid graceUntil timestamps.
  $code = ReplaceOne $code 'if \(now > graceExpiry\) \{' 'if (!Number.isFinite(graceExpiry) || now >= graceExpiry) {' 'grace period expiry guard'

  # Guard local cached ACTIVE state when the desktop app is started offline.
  # This must run after initial state hydration as well as the periodic check.
  $constructorCheck = [regex]::Matches($code, 'constructor\s*\(').Count
  Require ($constructorCheck -ge 1) 'Constructor not found; inspect startup expiry logic manually'

  $pkg = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
  foreach ($needed in @('main.cjs','preload.cjs','licensing-bridge.cjs','dist/**/*')) { Require (@($pkg.build.files) -contains $needed) "Installer files missing: $needed" }
  # Avoid replacing an existing 0.2.1 installer: package output in a separate folder and name.
  $pkg.build.directories.output = '../WINDOWS-LICENSING-TEST-OUTPUT'
  $pkg.build.nsis.artifactName = 'AI-Micro-Trader-LICENSING-TEST-Setup-${version}.exe'
  $pkgJson = $pkg | ConvertTo-Json -Depth 30

  SaveUtf8 $BridgePath $bridge
  SaveUtf8 $PreloadPath $preload
  SaveUtf8 $LicensePath $code
  SaveUtf8 $PackagePath $pkgJson

  foreach ($js in @($MainPath,$BridgePath,$PreloadPath)) {
    & node --check $js
    Require ($LASTEXITCODE -eq 0) "Syntax check failed: $js"
  }
  Write-Host 'JS SYNTAX CHECKS PASSED' -ForegroundColor Green

  Push-Location $Project
  try {
    $env:VITE_APP_DISTRIBUTION = 'desktop'
    try {
      & npm run build
      Require ($LASTEXITCODE -eq 0) 'Vite build failed'
    } finally { Remove-Item Env:\VITE_APP_DISTRIBUTION -ErrorAction SilentlyContinue }
    Require (Test-Path -LiteralPath (Join-Path $Project 'dist\index.html')) 'dist/index.html missing'
    $desktopDist = Join-Path $Desktop 'dist'
    if (Test-Path -LiteralPath $desktopDist) { Remove-Item -LiteralPath $desktopDist -Recurse -Force }
    Copy-Item -LiteralPath (Join-Path $Project 'dist') -Destination $desktopDist -Recurse
  } finally { Pop-Location }
  Write-Host 'DESKTOP FRONTEND BUILD PASSED' -ForegroundColor Green

  Push-Location $Desktop
  try {
    & npm run pack:win
    Require ($LASTEXITCODE -eq 0) 'Electron installer packaging failed'
  } finally { Pop-Location }

  $installer = Join-Path $Project 'WINDOWS-LICENSING-TEST-OUTPUT\AI-Micro-Trader-LICENSING-TEST-Setup-0.2.1.exe'
  Require (Test-Path -LiteralPath $installer) "Installer not found: $installer"
  "BUILD PASS`r`nInstaller: $installer`r`nBackup: $BackupDir`r`nLOCAL TEST ONLY: requires http://127.0.0.1:3000`r`nManual activation, verification, revocation, deactivation, offline startup and expiry tests still required." | Set-Content -LiteralPath $LogPath -Encoding UTF8
  Write-Host "TEST INSTALLER CREATED: $installer" -ForegroundColor Green
  Write-Host "RESULT LOG: $LogPath" -ForegroundColor Cyan
  Write-Host 'DO NOT DISTRIBUTE: local-only licensing API, runtime tests still required.' -ForegroundColor Yellow
} catch {
  Write-Host "STOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "BACKUP: $BackupDir" -ForegroundColor Yellow
  exit 1
}
