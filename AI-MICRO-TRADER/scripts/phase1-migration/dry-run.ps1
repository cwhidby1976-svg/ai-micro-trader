$ErrorActionPreference = "Stop"

$dbPath = Join-Path (Get-Location).Path "data\licensing_db.json"
$db = Get-Content $dbPath -Raw | ConvertFrom-Json

$tables = [ordered]@{
    adminUsers          = "amt_admin_users"
    members             = "amt_members"
    licenses            = "amt_licenses"
    orders              = "amt_orders"
    discountCodes       = "amt_discount_codes"
    discountRedemptions = "amt_discount_redemptions"
    auditLogs           = "amt_audit_logs"
    userApiKeys         = "amt_user_api_keys"
}

$issues = [System.Collections.Generic.List[string]]::new()
$total = 0

Write-Host "`n===== PHASE 1 MIGRATION DRY RUN =====" -ForegroundColor Cyan

foreach ($name in $tables.Keys) {
    $records = @($db.$name | Where-Object { $null -ne $_ })
    $total += $records.Count
    Write-Host "$name -> $($tables[$name]): $($records.Count)"
}

foreach ($name in @("adminUsers", "members", "licenses")) {
    foreach ($record in $db.$name) {
        if ([string]::IsNullOrWhiteSpace($record.id)) {
            $issues.Add("Missing ID in $name")
        }
    }
}

foreach ($member in $db.members) {
    if ($member.licenseId -and
        @($db.licenses | Where-Object { $_.id -eq $member.licenseId }).Count -ne 1) {
        $issues.Add("Unmatched customer-license relationship")
    }
}

foreach ($record in $db.userApiKeys) {
    if ([string]::IsNullOrWhiteSpace($record.ownerId)) {
        $issues.Add("API credential record missing owner ID")
    }
}

if ([string]::IsNullOrWhiteSpace($db.serverSecret)) {
    $issues.Add("Server signing secret missing")
}

if ($null -eq $db.config) {
    $issues.Add("Application configuration missing")
}

Write-Host "`nTotal records: $total"
Write-Host "Validation issues: $($issues.Count)"
Write-Host "Database writes performed: 0"

if ($issues.Count -eq 0 -and $total -eq 70) {
    Write-Host "PRELIMINARY DRY RUN PASSED" -ForegroundColor Green
} else {
    $issues | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    Write-Host "PRELIMINARY DRY RUN NEEDS REVIEW" -ForegroundColor Yellow
}
