param([string]$Root = 'C:\Users\Chris\Desktop\AI-MICRO-TRADER-DEMO-MANUAL-AUTOPILOT-UPDATE')
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw "Project root not found: $Root" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $env:TEMP "AI-MICRO-TRADER-DIAGNOSTIC-$stamp"
New-Item -ItemType Directory -Path $out -Force | Out-Null
$skipDirs = '(?i)[\\/](node_modules|\.git|dist|build|\.next|\.gradle|\.idea|coverage|\.cache|\.expo|android[\\/]\.gradle|WINDOWS-LICENSING-TEST-OUTPUT|WINDOWS-TEST-OUTPUT|LICENSING-FINAL-BACKUP-[^\\/]+)[\\/]'
$files = @(Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch $skipDirs })
$rel = { param($p) $p.Substring($Root.TrimEnd('\').Length).TrimStart('\') }
$inventory = foreach ($f in $files) { $r = & $rel $f.FullName; [pscustomobject]@{Path=$r; KB=[math]::Round($f.Length/1KB,1)} }
$inventory | Export-Csv (Join-Path $out 'file-inventory.csv') -NoTypeInformation -Encoding UTF8
$patterns = 'phantom|safepal|solana|walletconnect|deeplink|deep.link|mobile.wallet|transact|connectWallet|window\.solana|window\.phantom|window\.safepal|licens|autopilot|paper|jupiter|level6|candidateDiscovery'
$ext = @('.ts','.tsx','.js','.jsx','.cjs','.mjs','.json','.gradle','.kt','.java','.xml','.properties','.md')
$codeFiles = @($files | Where-Object { $ext -contains $_.Extension.ToLowerInvariant() -and $_.Length -lt 2MB -and $_.Name -notmatch '(?i)(lock|secret|credential|token|keystore|google-services|\.env)' })
$matches = @($codeFiles | Select-String -Pattern $patterns -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{Path=(& $rel $_.Path);Line=$_.LineNumber;Match=$_.Matches[0].Value} })
$matches | Export-Csv (Join-Path $out 'code-references.csv') -NoTypeInformation -Encoding UTF8
$meta = @($files | Where-Object { $_.Name -in @('package.json','vite.config.ts','capacitor.config.ts','capacitor.config.json','settings.gradle','settings.gradle.kts','build.gradle','build.gradle.kts','AndroidManifest.xml','main.cjs','preload.cjs','licensing-bridge.cjs') } | ForEach-Object { & $rel $_.FullName })
$meta | Set-Content (Join-Path $out 'configuration-paths.txt') -Encoding UTF8
$sourceCandidates = @($codeFiles | Where-Object { $_.FullName -match '(?i)(wallet|phantom|safepal|solana|deeplink|mobilewallet|capacitor|android)' -and $_.Extension -in @('.ts','.tsx','.js','.jsx','.cjs','.mjs','.kt','.java') } | Sort-Object Length)
$selected = @(); $total = 0
foreach ($f in $sourceCandidates) { if ($selected.Count -ge 35 -or $total + $f.Length -gt 800KB) { break }; $selected += $f; $total += $f.Length }
$srcOut = Join-Path $out 'selected-source'; New-Item -ItemType Directory -Path $srcOut -Force | Out-Null
foreach ($f in $selected) { $r = & $rel $f.FullName; $dest = Join-Path $srcOut $r; New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null; Copy-Item -LiteralPath $f.FullName -Destination $dest }
@("Root: $Root","Files inventoried: $($files.Count)","Code reference matches: $($matches.Count)","Selected wallet-related source files: $($selected.Count)","Windows app candidates: $(@($inventory | Where-Object Path -match 'WINDOWS').Count)","Android file candidates: $(@($inventory | Where-Object Path -match '(?i)android|capacitor').Count)","No code was changed. Review ZIP for secrets before uploading.") | Set-Content (Join-Path $out 'SUMMARY.txt') -Encoding UTF8
$zip = Join-Path $Root "AI-MICRO-TRADER-DIAGNOSTIC-$stamp.zip"
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -Force
Write-Host "DIAGNOSTIC COMPLETE" -ForegroundColor Green
Write-Host "REPORT: $zip"
Write-Host "SIZE: $([math]::Round((Get-Item $zip).Length/1MB,2)) MB"
Write-Host 'IMPORTANT: Review selected-source files for private keys, passwords, and secrets before uploading.' -ForegroundColor Yellow
