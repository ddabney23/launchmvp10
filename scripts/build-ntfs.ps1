# Build on NTFS (C:) — required when the project lives on exFAT (e.g. external O: drive).
$ErrorActionPreference = 'Stop'
$src = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dest = Join-Path $env:LOCALAPPDATA 'optimix-mvp-build'

Write-Host "Source: $src"
Write-Host "Build mirror: $dest"

if (-not (Test-Path $dest)) {
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

# Sync source without wiping node_modules (avoids locked-folder failures on re-runs)
robocopy $src $dest /MIR /XD .next node_modules _nm_staging /R:2 /W:5 /NP
if ($LASTEXITCODE -ge 8) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}

$envLocal = Join-Path $src '.env.local'
if (Test-Path $envLocal) {
  Copy-Item $envLocal (Join-Path $dest '.env.local') -Force
}

Push-Location $dest
try {
  if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing dependencies on NTFS mirror...'
    npm ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  if (Test-Path .next) {
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  }

  npm run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  Write-Host 'Build succeeded on NTFS mirror.'
} finally {
  Pop-Location
}
