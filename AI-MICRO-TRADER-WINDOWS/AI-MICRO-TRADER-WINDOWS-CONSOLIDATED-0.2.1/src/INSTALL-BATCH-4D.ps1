$ErrorActionPreference = 'Stop'
$Project = (Get-Location).Path
$Target = Join-Path $Project 'src\server\supabaseAuth.ts'
$Source = Join-Path $PSScriptRoot 'src\server\supabaseAuth.ts'
if (!(Test-Path (Join-Path $Project 'src\server\db.ts'))) { throw 'Run this from the project root.' }
if (!(Test-Path $Source)) { throw 'Package incomplete.' }
if (Test-Path $Target) { throw 'Target already exists; refusing to overwrite.' }
Copy-Item $Source $Target
try {
    & npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed.' }
    Write-Host 'BATCH 4D INSTALLED AND TYPESCRIPT VALIDATED' -ForegroundColor Green
    Write-Host 'API routes remain unchanged; no Supabase records written.'
} catch {
    Remove-Item $Target -Force
    Write-Host 'ROLLBACK: new file removed.' -ForegroundColor Yellow
    throw
}
