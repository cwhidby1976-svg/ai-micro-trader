$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
$Required = @('src\server\db.ts','src\server\routes.ts','src\components\admin\AdminPortal.tsx','src\components\MemberPortal.tsx','src\server\types.ts','package.json')
foreach ($file in $Required) { if (-not (Test-Path (Join-Path $Project $file))) { throw "Run from the AI Micro Trader project root. Missing: $file" } }
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Files = @('src\server\db.ts','src\server\routes.ts','src\components\admin\AdminPortal.tsx','src\components\MemberPortal.tsx')
foreach ($file in $Files) { if (-not (Test-Path (Join-Path $PackageRoot $file))) { throw "Installer package incomplete: $file" } }
$Backup = Join-Path $Project ('DISCOUNT-COUPON-BACKUP-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
foreach ($file in $Files) {
  $backupFile = Join-Path $Backup $file
  New-Item -ItemType Directory -Path (Split-Path $backupFile -Parent) -Force | Out-Null
  Copy-Item (Join-Path $Project $file) $backupFile -Force
}
Write-Host "Backup saved: $Backup" -ForegroundColor Cyan
try {
  foreach ($file in $Files) { Copy-Item (Join-Path $PackageRoot $file) (Join-Path $Project $file) -Force }
  & npx.cmd tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
  Write-Host 'COUPON FILES INSTALLED - TypeScript and build passed.' -ForegroundColor Green
  Write-Host 'Not deployed. Test with non-payment checkout quotes before enabling live payments.' -ForegroundColor Yellow
} catch {
  foreach ($file in $Files) { Copy-Item (Join-Path $Backup $file) (Join-Path $Project $file) -Force }
  Write-Host 'INSTALL FAILED - Original files restored from backup.' -ForegroundColor Red
  throw
}
