# Build on NTFS (C:) — required when the project lives on exFAT (e.g. external O: drive).
$ErrorActionPreference = 'Stop'
$src = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dest = Join-Path $env:LOCALAPPDATA 'optimix-mvp-build'
$logFile = Join-Path $src 'build-last.log'

function Write-Log($msg) {
  $line = "$(Get-Date -Format o) $msg"
  Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
  Write-Host $msg
}

Write-Log "Source: $src"
Write-Log "Build mirror: $dest"

if (-not (Test-Path $dest)) {
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$envLocal = Join-Path $src '.env.local'
if (Test-Path $envLocal) {
  Copy-Item $envLocal (Join-Path $dest '.env.local') -Force
  Write-Log 'Copied .env.local to mirror (for prisma postinstall / env)'
}

# Sync source without wiping node_modules (avoids locked-folder failures on re-runs)
robocopy $src $dest /MIR /XD .next node_modules _nm_staging /R:2 /W:5 /NP
$roboExit = $LASTEXITCODE
# Robocopy: 0-7 = success with various copy stats; 8+ = failure
if ($roboExit -ge 8) {
  Write-Log "ERROR: robocopy failed with exit code $roboExit"
  exit $roboExit
}
Write-Log "robocopy finished (exit $roboExit)"

Push-Location $dest
try {
  if (-not (Test-Path 'node_modules')) {
    Write-Log 'Installing dependencies on NTFS mirror...'
    npm ci 2>&1 | Tee-Object -FilePath $logFile -Append
    if ($LASTEXITCODE -ne 0) {
      Write-Log "ERROR: npm ci failed with exit $LASTEXITCODE"
      exit $LASTEXITCODE
    }
  }

  if (Test-Path .next) {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  }

  Write-Log 'Running npm run build:local (next build --webpack)...'
  # Use cmd so Next.js stderr warnings do not terminate PowerShell (ErrorAction Stop)
  cmd /c "npm run build:local >> `"$logFile`" 2>&1"
  $buildExit = $LASTEXITCODE
  if ($buildExit -ne 0) {
    Write-Log "ERROR: build failed with exit $buildExit"
    exit $buildExit
  }
  Write-Log 'Build succeeded on NTFS mirror.'
  exit 0
} finally {
  Pop-Location
}
