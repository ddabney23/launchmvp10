# Clerk Webhook Forwarding Script for Windows
# This script helps set up webhook forwarding for localhost development

Write-Host "🚀 Setting up Clerk Webhook Forwarding for Localhost" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install ngrok:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "  2. Or install via: npm install -g ngrok" -ForegroundColor Yellow
    Write-Host "  3. Or install via: scoop install ngrok" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installing, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ ngrok is installed" -ForegroundColor Green
Write-Host ""

# Check if dev server is running
$devServerRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    $devServerRunning = $true
} catch {
    $devServerRunning = $false
}

if (-not $devServerRunning) {
    Write-Host "⚠️  Warning: Dev server doesn't appear to be running on port 3000" -ForegroundColor Yellow
    Write-Host "   Please start your dev server first: npm run dev" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
} else {
    Write-Host "✅ Dev server is running on port 3000" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Starting ngrok tunnel..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Copy the HTTPS URL from ngrok (e.g., https://abc123.ngrok-free.app)" -ForegroundColor White
Write-Host "  2. Go to Clerk Dashboard: https://dashboard.clerk.com" -ForegroundColor White
Write-Host "  3. Navigate to: Webhooks → Add Endpoint" -ForegroundColor White
Write-Host "  4. Enter URL: https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/clerk" -ForegroundColor White
Write-Host "  5. Select events: user.created, user.updated, user.deleted" -ForegroundColor White
Write-Host "  6. Copy the Signing Secret to your .env.local as CLERK_WEBHOOK_SECRET" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Gray
Write-Host ""

# Start ngrok
ngrok http 3000

