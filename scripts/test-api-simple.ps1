# API Routes Testing Script - Simplified
# Tests all 18 existing API endpoints

$baseUrl = "http://localhost:3000"
$testResults = @()
$sep = "=" * 60

Write-Host ""
Write-Host "API Routes Testing Suite" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Gray

# Check if server is running
Write-Host ""
Write-Host "Checking if dev server is running..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "Server is running on $baseUrl" -ForegroundColor Green
} catch {
    Write-Host "Server not running! Tests may fail." -ForegroundColor Red
    Write-Host "Please run: npm run dev" -ForegroundColor Yellow
}

Write-Host ""
Write-Host $sep -ForegroundColor Gray
Write-Host "Testing API Endpoints" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Gray

# Test 1: Health Check
Write-Host ""
Write-Host "[1/18] Testing Health Check..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 10
    if ($response.status -eq "healthy" -or $response.status -eq "degraded") {
        Write-Host "  PASS: Health: $($response.status)" -ForegroundColor Green
        $testResults += @{Name="Health Check"; Status="PASS"; Details=$response.status}
    } else {
        Write-Host "  WARN: Unhealthy: $($response.status)" -ForegroundColor Yellow
        $testResults += @{Name="Health Check"; Status="WARN"; Details=$response.status}
    }
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{Name="Health Check"; Status="FAIL"; Details=$_.Exception.Message}
}

# Test 2: Upload (without auth - should fail with 401)
Write-Host ""
Write-Host "[2/18] Testing Upload (No Auth)..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/upload" -Method POST -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require auth)" -ForegroundColor Yellow
    $testResults += @{Name="Upload (No Auth)"; Status="WARN"; Details="Should return 401"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  PASS: Correctly requires authentication (401)" -ForegroundColor Green
        $testResults += @{Name="Upload (No Auth)"; Status="PASS"; Details="Requires auth"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Upload (No Auth)"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 3: Webhooks - Clerk
Write-Host ""
Write-Host "[3/18] Testing Clerk Webhook (No Signature)..." -ForegroundColor Cyan
try {
    $body = @{type="user.created"; data=@{id="test"}} | ConvertTo-Json
    $null = Invoke-WebRequest -Uri "$baseUrl/api/webhooks/clerk" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require signature)" -ForegroundColor Yellow
    $testResults += @{Name="Clerk Webhook"; Status="WARN"; Details="Should validate signature"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  PASS: Correctly validates webhook signature" -ForegroundColor Green
        $testResults += @{Name="Clerk Webhook"; Status="PASS"; Details="Validates signature"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Clerk Webhook"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 4: Webhooks - Stripe
Write-Host ""
Write-Host "[4/18] Testing Stripe Webhook (No Signature)..." -ForegroundColor Cyan
try {
    $body = @{type="payment_intent.succeeded"; data=@{object=@{}}} | ConvertTo-Json
    $null = Invoke-WebRequest -Uri "$baseUrl/api/webhooks/stripe" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require signature)" -ForegroundColor Yellow
    $testResults += @{Name="Stripe Webhook"; Status="WARN"; Details="Should validate signature"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  PASS: Correctly validates webhook signature" -ForegroundColor Green
        $testResults += @{Name="Stripe Webhook"; Status="PASS"; Details="Validates signature"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Stripe Webhook"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 5: Webhook Logs
Write-Host ""
Write-Host "[5/18] Testing Webhook Logs..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/webhooks/logs" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Endpoint exists but may need auth" -ForegroundColor Yellow
    $testResults += @{Name="Webhook Logs"; Status="WARN"; Details="Check auth requirements"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  PASS: Correctly requires authentication" -ForegroundColor Green
        $testResults += @{Name="Webhook Logs"; Status="PASS"; Details="Requires auth"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Webhook Logs"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 6: Vendor Applications
Write-Host ""
Write-Host "[6/18] Testing Vendor Applications..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/vendor/applications" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require admin auth)" -ForegroundColor Yellow
    $testResults += @{Name="Vendor Applications"; Status="WARN"; Details="Should require admin"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  PASS: Correctly requires admin authentication" -ForegroundColor Green
        $testResults += @{Name="Vendor Applications"; Status="PASS"; Details="Requires admin"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Vendor Applications"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 7: Vendor Verify
Write-Host ""
Write-Host "[7/18] Testing Vendor Verify..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/vendor/verify" -Method POST -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require admin auth)" -ForegroundColor Yellow
    $testResults += @{Name="Vendor Verify"; Status="WARN"; Details="Should require admin"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  PASS: Correctly requires admin authentication" -ForegroundColor Green
        $testResults += @{Name="Vendor Verify"; Status="PASS"; Details="Requires admin"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Vendor Verify"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 8: Gamification Update
Write-Host ""
Write-Host "[8/18] Testing Gamification Update..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/gamification/update" -Method POST -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require auth)" -ForegroundColor Yellow
    $testResults += @{Name="Gamification Update"; Status="WARN"; Details="Should require auth"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  PASS: Correctly requires authentication or valid body" -ForegroundColor Green
        $testResults += @{Name="Gamification Update"; Status="PASS"; Details="Protected"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Gamification Update"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 9: Bookings Create
Write-Host ""
Write-Host "[9/18] Testing Bookings Create..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/bookings/create" -Method POST -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require auth)" -ForegroundColor Yellow
    $testResults += @{Name="Bookings Create"; Status="WARN"; Details="Should require auth"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  PASS: Correctly requires authentication or valid body" -ForegroundColor Green
        $testResults += @{Name="Bookings Create"; Status="PASS"; Details="Protected"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Bookings Create"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 10: Bookings Update
Write-Host ""
Write-Host "[10/18] Testing Bookings Update..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/bookings/update" -Method POST -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require auth)" -ForegroundColor Yellow
    $testResults += @{Name="Bookings Update"; Status="WARN"; Details="Should require auth"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  PASS: Correctly requires authentication or valid body" -ForegroundColor Green
        $testResults += @{Name="Bookings Update"; Status="PASS"; Details="Protected"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Bookings Update"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 11: Payment Create Intent
Write-Host ""
Write-Host "[11/18] Testing Payment Create Intent..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/payment/create-intent" -Method POST -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require auth)" -ForegroundColor Yellow
    $testResults += @{Name="Payment Create Intent"; Status="WARN"; Details="Should require auth"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  PASS: Correctly requires authentication or valid body" -ForegroundColor Green
        $testResults += @{Name="Payment Create Intent"; Status="PASS"; Details="Protected"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Payment Create Intent"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 12: Admin Badges
Write-Host ""
Write-Host "[12/18] Testing Admin Badges..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/admin/badges" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require admin auth)" -ForegroundColor Yellow
    $testResults += @{Name="Admin Badges"; Status="WARN"; Details="Should require admin"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  PASS: Correctly requires admin authentication" -ForegroundColor Green
        $testResults += @{Name="Admin Badges"; Status="PASS"; Details="Requires admin"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Admin Badges"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 13: Admin Users Search
Write-Host ""
Write-Host "[13/18] Testing Admin Users Search..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/admin/users/search?q=test" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require admin auth)" -ForegroundColor Yellow
    $testResults += @{Name="Admin Users Search"; Status="WARN"; Details="Should require admin"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  PASS: Correctly requires admin authentication" -ForegroundColor Green
        $testResults += @{Name="Admin Users Search"; Status="PASS"; Details="Requires admin"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Admin Users Search"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 14: Admin Users Export
Write-Host ""
Write-Host "[14/18] Testing Admin Users Export..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "$baseUrl/api/admin/users/export" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "  WARN: Unexpected success (should require admin auth)" -ForegroundColor Yellow
    $testResults += @{Name="Admin Users Export"; Status="WARN"; Details="Should require admin"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  PASS: Correctly requires admin authentication" -ForegroundColor Green
        $testResults += @{Name="Admin Users Export"; Status="PASS"; Details="Requires admin"}
    } else {
        Write-Host "  FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testResults += @{Name="Admin Users Export"; Status="FAIL"; Details=$_.Exception.Message}
    }
}

# Test 15-18: Dynamic routes (skipped)
Write-Host ""
Write-Host "[15/18] Admin User Detail Route..." -ForegroundColor Cyan
Write-Host "  SKIP: Requires valid user ID" -ForegroundColor Gray
$testResults += @{Name="Admin User Detail"; Status="SKIP"; Details="Requires user ID"}

Write-Host ""
Write-Host "[16/18] Admin User Roles Route..." -ForegroundColor Cyan
Write-Host "  SKIP: Requires valid user ID" -ForegroundColor Gray
$testResults += @{Name="Admin User Roles"; Status="SKIP"; Details="Requires user ID"}

Write-Host ""
Write-Host "[17/18] Admin User Badges Route..." -ForegroundColor Cyan
Write-Host "  SKIP: Requires valid user ID" -ForegroundColor Gray
$testResults += @{Name="Admin User Badges"; Status="SKIP"; Details="Requires user ID"}

Write-Host ""
Write-Host "[18/18] Vendor Application Detail Route..." -ForegroundColor Cyan
Write-Host "  SKIP: Requires valid application ID" -ForegroundColor Gray
$testResults += @{Name="Vendor Application Detail"; Status="SKIP"; Details="Requires application ID"}

# Summary
Write-Host ""
Write-Host $sep -ForegroundColor Gray
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host $sep -ForegroundColor Gray

$passCount = ($testResults | Where-Object {$_.Status -eq "PASS"}).Count
$warnCount = ($testResults | Where-Object {$_.Status -eq "WARN"}).Count
$failCount = ($testResults | Where-Object {$_.Status -eq "FAIL"}).Count
$skipCount = ($testResults | Where-Object {$_.Status -eq "SKIP"}).Count

Write-Host ""
Write-Host "PASSED: $passCount" -ForegroundColor Green
Write-Host "WARNED: $warnCount" -ForegroundColor Yellow
Write-Host "FAILED: $failCount" -ForegroundColor Red
Write-Host "SKIPPED: $skipCount" -ForegroundColor Gray

Write-Host ""
Write-Host "Detailed Results:" -ForegroundColor Cyan
foreach ($result in $testResults) {
    $icon = switch ($result.Status) {
        "PASS" { "[OK]" }
        "WARN" { "[!!]" }
        "FAIL" { "[XX]" }
        "SKIP" { "[--]" }
    }
    $color = switch ($result.Status) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        "SKIP" { "Gray" }
    }
    Write-Host "  $icon $($result.Name): $($result.Details)" -ForegroundColor $color
}

Write-Host ""
Write-Host $sep -ForegroundColor Gray
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Review warnings - ensure auth is working as expected" -ForegroundColor Gray
Write-Host "  2. Fix any failures" -ForegroundColor Gray
Write-Host "  3. Test authenticated endpoints with valid tokens" -ForegroundColor Gray
Write-Host "  4. Proceed to Phase 3.3: Implement missing routes" -ForegroundColor Gray
Write-Host $sep -ForegroundColor Gray
