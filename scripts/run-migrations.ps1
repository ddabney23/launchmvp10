# PowerShell script to automatically run Supabase migrations
# This script runs all pending migrations in order

param(
    [string]$SupabaseProjectRef = "",
    [string]$SupabaseDbPassword = "",
    [switch]$SkipConfirmation = $false
)

Write-Host "🚀 Supabase Migration Runner" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI is not installed!" -ForegroundColor Red
    Write-Host "Install it with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Get project ref from environment or parameter
if ([string]::IsNullOrEmpty($SupabaseProjectRef)) {
    $SupabaseProjectRef = $env:SUPABASE_PROJECT_REF
}

if ([string]::IsNullOrEmpty($SupabaseProjectRef)) {
    Write-Host "⚠️  SUPABASE_PROJECT_REF not set" -ForegroundColor Yellow
    Write-Host "You can:" -ForegroundColor Yellow
    Write-Host "  1. Set environment variable: `$env:SUPABASE_PROJECT_REF = 'your-project-ref'" -ForegroundColor Gray
    Write-Host "  2. Or pass as parameter: .\scripts\run-migrations.ps1 -SupabaseProjectRef 'your-project-ref'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternatively, run migrations manually in Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://app.supabase.com" -ForegroundColor Gray
    Write-Host "  2. Select your project" -ForegroundColor Gray
    Write-Host "  3. Go to Database → Migrations" -ForegroundColor Gray
    Write-Host "  4. Or use SQL Editor to run migration files" -ForegroundColor Gray
    exit 0
}

# Get migrations directory
$migrationsDir = Join-Path $PSScriptRoot "..\supabase\migrations"
if (-not (Test-Path $migrationsDir)) {
    Write-Host "❌ Migrations directory not found: $migrationsDir" -ForegroundColor Red
    exit 1
}

# Get all migration files
$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "⚠️  No migration files found in $migrationsDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "📋 Found $($migrationFiles.Count) migration files" -ForegroundColor Green
Write-Host ""

if (-not $SkipConfirmation) {
    Write-Host "This will run all migrations on your Supabase project." -ForegroundColor Yellow
    $confirm = Read-Host "Continue? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "🔄 Running migrations..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$errorCount = 0

foreach ($file in $migrationFiles) {
    Write-Host "  Running: $($file.Name)..." -ForegroundColor Gray -NoNewline
    
    try {
        # Read SQL file
        $sql = Get-Content -Path $file.FullName -Raw
        
        # Run via Supabase CLI
        $result = supabase db push --db-url "postgresql://postgres:$SupabaseDbPassword@db.$SupabaseProjectRef.supabase.co:5432/postgres" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✅" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host " ❌ Error" -ForegroundColor Red
            Write-Host "    $result" -ForegroundColor Red
            $errorCount++
        }
    } catch {
        Write-Host " ❌ Exception: $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Successful: $successCount" -ForegroundColor Green
Write-Host "  ❌ Errors: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })

if ($errorCount -eq 0) {
    Write-Host ""
    Write-Host "✅ All migrations completed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Some migrations failed. Check the errors above." -ForegroundColor Yellow
    Write-Host "You can also run migrations manually in Supabase Dashboard → SQL Editor" -ForegroundColor Yellow
}

