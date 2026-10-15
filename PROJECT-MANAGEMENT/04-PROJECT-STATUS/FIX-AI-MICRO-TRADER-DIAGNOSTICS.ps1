$ErrorActionPreference = 'Stop'
$Root = 'C:\Users\Chris\Desktop\AI-MICRO-TRADER-DEMO-MANUAL-AUTOPILOT-UPDATE'
$Projects = @(
  (Join-Path $Root 'AI-MICRO-TRADER'),
  (Join-Path $Root 'AI-MICRO-TRADER-WINDOWS\AI-MICRO-TRADER-WINDOWS-CONSOLIDATED-0.2.1')
)
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $Root "BACKUP-BEFORE-DIAGNOSTICS-$Timestamp"
$Changes = @(
  @{ Old = "solanaRpc: { status: 'SUCCESS', latencyMs: 24, message: 'Solana RPC WebSocket Stream Active (24ms ping)' }"; New = "solanaRpc: { status: 'ERROR', message: 'Solana RPC health check failed. No live RPC connection was verified.' }" },
  @{ Old = "goplus: { status: 'SUCCESS', latencyMs: 36, message: 'GoPlus Security Engine Ingestion Active (36ms response)' }"; New = "goplus: { status: 'ERROR', message: 'GoPlus security API check failed. No connection was verified.' }" },
  @{ Old = "jupiter: { status: 'SUCCESS', latencyMs: 22, message: 'Jupiter v6 Route Aggregator Active (22ms)' }"; New = "jupiter: { status: 'ERROR', message: 'Jupiter API check failed. No route service connection was verified.' }" },
  @{ Old = "message: `Machine Fingerprint (`${licenseState.deviceId || 'HWID-BOUND'}) Cryptographically Authenticated`,"; New = "message: 'License server verification request failed. Device authentication was not verified.'," }
)
$Targets = @()
foreach ($Project in $Projects) {
  $Path = Join-Path $Project 'src\components\Dashboard.tsx'
  if (-not (Test-Path -LiteralPath $Path)) { throw "Missing Dashboard.tsx: $Path" }
  $Original = [System.IO.File]::ReadAllText($Path)
  $Updated = $Original
  foreach ($Change in $Changes) {
    if (-not $Updated.Contains($Change.Old)) { throw "Expected diagnostic code not found in $Path : $($Change.Old)" }
    $Updated = $Updated.Replace($Change.Old, $Change.New)
  }
  $Targets += [pscustomobject]@{ Path=$Path; Project=$Project; Original=$Original; Updated=$Updated }
}
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
foreach ($Target in $Targets) {
  $Label = if ($Target.Project -eq $Projects[0]) { 'WEB' } else { 'WINDOWS' }
  $Backup = Join-Path $BackupRoot "$Label-Dashboard.tsx"
  [System.IO.File]::WriteAllText($Backup, $Target.Original, [System.Text.UTF8Encoding]::new($false))
}
try {
  foreach ($Target in $Targets) {
    [System.IO.File]::WriteAllText($Target.Path, $Target.Updated, [System.Text.UTF8Encoding]::new($false))
    Write-Host "PATCHED: $($Target.Path)" -ForegroundColor Green
  }
  foreach ($Target in $Targets) {
    foreach ($Change in $Changes) {
      if (-not ([System.IO.File]::ReadAllText($Target.Path)).Contains($Change.New)) { throw "Verification failed: $($Target.Path)" }
    }
  }
  Write-Host "SUCCESS: False-positive diagnostic fallbacks corrected in website and Windows source." -ForegroundColor Green
  Write-Host "BACKUP: $BackupRoot" -ForegroundColor Cyan
  Write-Host 'No changes made to trading engine, wallet signing, Paper Mode, or licensing entitlements.' -ForegroundColor Yellow
} catch {
  foreach ($Target in $Targets) { [System.IO.File]::WriteAllText($Target.Path, $Target.Original, [System.Text.UTF8Encoding]::new($false)) }
  Write-Host 'ROLLED BACK due to error.' -ForegroundColor Red
  throw
}
