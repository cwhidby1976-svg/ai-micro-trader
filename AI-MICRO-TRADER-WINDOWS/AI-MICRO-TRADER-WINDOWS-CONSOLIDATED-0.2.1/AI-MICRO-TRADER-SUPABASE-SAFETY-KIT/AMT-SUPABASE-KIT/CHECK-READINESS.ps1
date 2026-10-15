$ErrorActionPreference = 'Stop'
$project = (Get-Location).Path
$required = @('server.ts','src/server/db.ts','src/server/routes.ts','src/server/supabase.ts','src/server/supabaseAuth.ts','src/server/types.ts','package.json')
$missing = @($required | Where-Object { -not (Test-Path (Join-Path $project $_)) })
if ($missing.Count -gt 0) { throw ('Missing files: ' + ($missing -join ', ')) }
Write-Host 'Source files present.' -ForegroundColor Green
Write-Host 'Supabase auth functions:' -ForegroundColor Cyan
Select-String -Path 'src/server/supabaseAuth.ts' -Pattern 'export async function' | ForEach-Object { Write-Host $_.Line.Trim() }
Write-Host 'Local JSON persistence references:' -ForegroundColor Cyan
Select-String -Path 'src/server/db.ts' -Pattern 'licensing_db.json|private saveData|private loadData' | ForEach-Object { Write-Host ($_.LineNumber.ToString() + ': ' + $_.Line.Trim()) }
Write-Host 'Route references still using local database:' -ForegroundColor Cyan
Select-String -Path 'src/server/routes.ts' -Pattern 'db.registerMember|db.verifyMemberPassword|db.createFirstAdmin|db.getMemberById|db.getAdminById' | ForEach-Object { Write-Host ($_.LineNumber.ToString() + ': ' + $_.Line.Trim()) }
Write-Host 'TypeScript check:' -ForegroundColor Cyan
& npm run lint
if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed' }
Write-Host 'PREFLIGHT PASSED. No files changed; Supabase migration NOT installed.' -ForegroundColor Green
