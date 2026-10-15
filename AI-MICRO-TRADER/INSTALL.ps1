$ErrorActionPreference = 'Stop'
$project = (Get-Location).Path
$source = Join-Path $PSScriptRoot 'src\server\supabaseAdminProvisioning.ts'
$target = Join-Path $project 'src\server\supabaseAdminProvisioning.ts'
if (-not (Test-Path (Join-Path $project 'src\server\db.ts'))) { throw 'Run installer from the AI Micro Trader project root.' }
if (-not (Test-Path $source)) { throw 'Installer is incomplete.' }
if (Test-Path $target) { throw 'Target already exists; no files changed.' }
Copy-Item -LiteralPath $source -Destination $target
try {
  & npm run lint
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed' }
  Write-Host 'Atomic admin provisioning module installed and TypeScript checked.' -ForegroundColor Green
  Write-Host 'NOT ENABLED: SQL migration and API route wiring are still required.' -ForegroundColor Yellow
} catch {
  Remove-Item -LiteralPath $target -Force
  throw
}
