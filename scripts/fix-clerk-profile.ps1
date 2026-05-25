# Fix Clerk Profile for ddabney23@gmail.com
# Run: .\scripts\fix-clerk-profile.ps1

Write-Host "🔧 Fixing Clerk profile for ddabney23@gmail.com..." -ForegroundColor Cyan
Write-Host ""

node scripts\check-clerk-profile.js user_35REqBwCK0OWulDHjBgeaPdfBnO

Write-Host ""
Write-Host "✅ Done! Please refresh your browser." -ForegroundColor Green
