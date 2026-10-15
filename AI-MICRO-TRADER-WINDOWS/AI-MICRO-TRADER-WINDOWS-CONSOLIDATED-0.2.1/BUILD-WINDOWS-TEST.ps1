$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host 'Building AI Micro Trader consolidated Windows TEST v0.2.1' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'Frontend npm install failed' }
$env:VITE_APP_DISTRIBUTION = 'desktop'
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Remove-Item Env:\VITE_APP_DISTRIBUTION -ErrorAction SilentlyContinue }
if (!(Test-Path '.\dist\index.html')) { throw 'Missing dist/index.html' }
if (Test-Path '.\desktop\dist') { Remove-Item '.\desktop\dist' -Recurse -Force }
Copy-Item '.\dist' '.\desktop\dist' -Recurse
Push-Location '.\desktop'
try {
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'Desktop npm install failed' }
  npm run pack:win
  if ($LASTEXITCODE -ne 0) { throw 'Installer packaging failed' }
} finally { Pop-Location }
Write-Host 'Windows TEST installer ready in WINDOWS-TEST-OUTPUT' -ForegroundColor Green
