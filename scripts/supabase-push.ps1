# Push migrations via Supabase CLI using DATABASE_URL from .env.local
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$logFile = Join-Path $root 'supabase-push.log'
'' | Set-Content $logFile

function Log($msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

Log "cwd: $root"

$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) {
  Log 'ERROR: .env.local not found'
  exit 1
}

$dbUrl = $null
$projectRef = $null
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*DATABASE_URL=(.+)$') {
    $dbUrl = $matches[1].Trim().Trim('"').Trim("'")
  }
  if ($_ -match '^\s*NEXT_PUBLIC_SUPABASE_URL=https://([^.]+)\.supabase\.co') {
    $projectRef = $matches[1]
  }
}

if (-not $dbUrl) {
  Log 'ERROR: DATABASE_URL missing in .env.local'
  exit 1
}

Log "Project ref from env: $projectRef"

Log 'Checking supabase CLI...'
$ver = npx supabase --version 2>&1 | Out-String
Log "supabase version: $($ver.Trim())"

Log 'Running supabase db push...'
$push = npx supabase db push --db-url $dbUrl 2>&1 | Out-String
Log $push
if ($LASTEXITCODE -ne 0) {
  Log "ERROR: db push exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Log 'Done.'
exit 0
