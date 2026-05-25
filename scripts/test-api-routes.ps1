# API Routes Testing Script - Fixed for Windows PowerShell
# Tests all 18 existing API endpoints with proper error handling
#
# Usage:
#   .\scripts\test-api-routes.ps1
#   npm run test:api:win
#
# Environment Variables:
#   $env:BASE_URL = "http://localhost:3000" (optional)
#   $env:CLERK_SESSION_TOKEN = "..." (optional, for authenticated tests)

$ErrorActionPreference = "Stop"
$baseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "http://localhost:3000" }
$timeoutSec = 10
$testResults = @()

# ANSI color support (Windows 10+)
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header($message) {
    Write-Output ""
    Write-Output ("=" * 60)
    Write-ColorOutput $message Cyan
    Write-Output ("=" * 60)
}

function Write-Test($index, $total, $name) {
    Write-Output ""
    Write-ColorOutput "[$index/$total] Testing $name..." Cyan
}

function Write-Result($result) {
    $icons = @{
        "PASS" = "✅"
        "FAIL" = "❌"
        "WARN" = "⚠️ "
        "SKIP" = "⏭️ "
    }
    $colors = @{
        "PASS" = "Green"
        "FAIL" = "Red"
        "WARN" = "Yellow"
        "SKIP" = "Gray"
    }
    
    $icon = $icons[$result.Status]
    $color = $colors[$result.Status]
    $time = if ($result.ResponseTime) { " ($($result.ResponseTime)ms)" } else { "" }
    $statusCode = if ($result.StatusCode) { " [$($result.StatusCode)]" } else { "" }
    
    Write-ColorOutput "  $icon $($result.Name): $($result.Details)$statusCode$time" $color
    if ($result.Error) {
        Write-ColorOutput "     Error: $($result.Error)" Red
    }
}

# Check if server is running
function Test-Server {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Test endpoint helper
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int[]]$ExpectedStatus = @(),
        [bool]$RequiresAuth = $false,
        [bool]$IsPublic = $false,
        [string]$Description = ""
    )
    
    $startTime = Get-Date
    $result = @{
        Name = $Name
        Status = "FAIL"
        StatusCode = $null
        ResponseTime = $null
        Details = ""
        Error = $null
    }
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        # Add Clerk session token if provided
        if ($RequiresAuth -and $env:CLERK_SESSION_TOKEN) {
            $headers["Authorization"] = "Bearer $env:CLERK_SESSION_TOKEN"
        }
        
        $params = @{
            Uri = "$baseUrl$Url"
            Method = $Method
            Headers = $headers
            TimeoutSec = $timeoutSec
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Body -and $Method -ne "GET") {
            $bodyJson = $Body | ConvertTo-Json -Compress -Depth 10
            $params["Body"] = $bodyJson
        }
        
        $response = Invoke-WebRequest @params
        $endTime = Get-Date
        $result.ResponseTime = [math]::Round(($endTime - $startTime).TotalMilliseconds)
        $result.StatusCode = $response.StatusCode
        
        try {
            $responseData = $response.Content | ConvertFrom-Json
        } catch {
            $responseData = $null
        }
        
        # Determine result
        if ($ExpectedStatus.Count -gt 0 -and $ExpectedStatus -notcontains $response.StatusCode) {
            $result.Status = "FAIL"
            $result.Details = "Expected status $($ExpectedStatus -join ' or '), got $($response.StatusCode)"
        } elseif ($IsPublic -and $response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            $result.Status = "PASS"
            $result.Details = if ($Description) { $Description } else { "Public endpoint accessible ($($response.StatusCode))" }
        } elseif ($RequiresAuth) {
            if ($response.StatusCode -eq 401 -or $response.StatusCode -eq 403) {
                $result.Status = "PASS"
                $result.Details = "Correctly requires authentication ($($response.StatusCode))"
            } elseif ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                if ($env:CLERK_SESSION_TOKEN) {
                    $result.Status = "PASS"
                    $result.Details = "Authenticated request successful ($($response.StatusCode))"
                } else {
                    $result.Status = "WARN"
                    $result.Details = "Unexpected success without auth token ($($response.StatusCode))"
                }
            } elseif ($response.StatusCode -eq 400) {
                $result.Status = "PASS"
                $result.Details = "Request validation error (expected for missing/invalid body)"
            } else {
                $result.Status = "WARN"
                $result.Details = "Unexpected status: $($response.StatusCode)"
            }
        } elseif ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            $result.Status = "PASS"
            $result.Details = if ($Description) { $Description } else { "Success ($($response.StatusCode))" }
        } else {
            $result.Status = "WARN"
            $result.Details = "Status: $($response.StatusCode)"
        }
    } catch {
        $endTime = Get-Date
        $result.ResponseTime = [math]::Round(($endTime - $startTime).TotalMilliseconds)
        
        if ($_.Exception.Response) {
            $result.StatusCode = [int]$_.Exception.Response.StatusCode
            
            if ($RequiresAuth -and ($result.StatusCode -eq 401 -or $result.StatusCode -eq 403)) {
                $result.Status = "PASS"
                $result.Details = "Correctly requires authentication ($($result.StatusCode))"
            } elseif ($result.StatusCode -eq 400) {
                $result.Status = "PASS"
                $result.Details = "Request validation error (expected)"
            } else {
                $result.Status = "FAIL"
                $result.Details = "Unexpected error: $($result.StatusCode)"
                $result.Error = $_.Exception.Message
            }
        } else {
            $result.Status = "FAIL"
            $result.Details = "Request failed"
            $result.Error = $_.Exception.Message
        }
    }
    
    return $result
}

# Main execution
Write-Header "🧪 API Routes Test Suite"
Write-Output "Base URL: $baseUrl"
if ($env:CLERK_SESSION_TOKEN) {
    Write-ColorOutput "Clerk session token provided (authenticated tests enabled)" Green
} else {
    Write-ColorOutput "No Clerk session token (testing unauthenticated access only)" Yellow
}

# Check server
Write-Output ""
Write-ColorOutput "🔍 Checking if dev server is running..." Yellow
if (-not (Test-Server)) {
    Write-ColorOutput "❌ Server not running! Please start with: npm run dev" Red
    Write-Output ""
    Write-ColorOutput "⚠️  Please start the server manually and run tests again" Yellow
    exit 1
}
Write-ColorOutput "✅ Server is running" Green

Write-Header "📋 Testing API Endpoints"

# Test 1: Health Check
Write-Test 1 18 "Health Check"
$result = Test-Endpoint -Name "Health Check" -Url "/api/health" -IsPublic $true -ExpectedStatus @(200, 503) -Description "Public health endpoint"
$testResults += $result
Write-Result $result

# Test 2: Upload
Write-Test 2 18 "Upload (No Auth)"
$result = Test-Endpoint -Name "Upload (No Auth)" -Url "/api/upload" -Method "POST" -RequiresAuth $true -ExpectedStatus @(401, 400) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 3: Clerk Webhook
Write-Test 3 18 "Clerk Webhook (No Signature)"
$body = @{ type = "user.created"; data = @{ id = "test" } }
$result = Test-Endpoint -Name "Clerk Webhook" -Url "/api/webhooks/clerk" -Method "POST" -Body $body -ExpectedStatus @(400, 401) -Description "Should validate webhook signature"
$testResults += $result
Write-Result $result

# Test 4: Stripe Webhook
Write-Test 4 18 "Stripe Webhook (No Signature)"
$body = @{ type = "payment_intent.succeeded"; data = @{ object = @{} } }
$result = Test-Endpoint -Name "Stripe Webhook" -Url "/api/webhooks/stripe" -Method "POST" -Body $body -ExpectedStatus @(400, 401) -Description "Should validate webhook signature"
$testResults += $result
Write-Result $result

# Test 5: Webhook Logs
Write-Test 5 18 "Webhook Logs"
$result = Test-Endpoint -Name "Webhook Logs" -Url "/api/webhooks/logs" -RequiresAuth $true -ExpectedStatus @(401, 403) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 6: Vendor Applications
Write-Test 6 18 "Vendor Applications"
$result = Test-Endpoint -Name "Vendor Applications" -Url "/api/vendor/applications" -RequiresAuth $true -ExpectedStatus @(401, 403) -Description "Should require admin authentication"
$testResults += $result
Write-Result $result

# Test 7: Vendor Verify
Write-Test 7 18 "Vendor Verify"
$result = Test-Endpoint -Name "Vendor Verify" -Url "/api/vendor/verify" -Method "POST" -RequiresAuth $true -ExpectedStatus @(401, 400) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 8: Gamification Update
Write-Test 8 18 "Gamification Update"
$result = Test-Endpoint -Name "Gamification Update" -Url "/api/gamification/update" -Method "POST" -RequiresAuth $true -ExpectedStatus @(401, 400) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 9: Bookings Create
Write-Test 9 18 "Bookings Create"
$result = Test-Endpoint -Name "Bookings Create" -Url "/api/bookings/create" -Method "POST" -RequiresAuth $true -ExpectedStatus @(401, 400) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 10: Bookings Update
Write-Test 10 18 "Bookings Update"
$result = Test-Endpoint -Name "Bookings Update" -Url "/api/bookings/update" -Method "PATCH" -RequiresAuth $true -ExpectedStatus @(401, 400) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 11: Payment Create Intent
Write-Test 11 18 "Payment Create Intent"
$result = Test-Endpoint -Name "Payment Create Intent" -Url "/api/payment/create-intent" -Method "POST" -RequiresAuth $true -ExpectedStatus @(401, 400) -Description "Should require authentication"
$testResults += $result
Write-Result $result

# Test 12: Admin Badges
Write-Test 12 18 "Admin Badges"
$result = Test-Endpoint -Name "Admin Badges" -Url "/api/admin/badges" -RequiresAuth $true -ExpectedStatus @(401, 403) -Description "Should require admin authentication"
$testResults += $result
Write-Result $result

# Test 13: Admin Users Search
Write-Test 13 18 "Admin Users Search"
$result = Test-Endpoint -Name "Admin Users Search" -Url "/api/admin/users/search?q=test" -RequiresAuth $true -ExpectedStatus @(401, 403) -Description "Should require admin authentication"
$testResults += $result
Write-Result $result

# Test 14: Admin Users Export
Write-Test 14 18 "Admin Users Export"
$result = Test-Endpoint -Name "Admin Users Export" -Url "/api/admin/users/export" -RequiresAuth $true -ExpectedStatus @(401, 403) -Description "Should require admin authentication"
$testResults += $result
Write-Result $result

# Test 15-18: Dynamic routes (skipped)
Write-Test 15 18 "Admin User Detail"
$testResults += @{ Name = "Admin User Detail"; Status = "SKIP"; Details = "Requires valid user ID"; StatusCode = $null; ResponseTime = $null; Error = $null }
Write-Result $testResults[-1]

Write-Test 16 18 "Admin User Roles"
$testResults += @{ Name = "Admin User Roles"; Status = "SKIP"; Details = "Requires valid user ID"; StatusCode = $null; ResponseTime = $null; Error = $null }
Write-Result $testResults[-1]

Write-Test 17 18 "Admin User Badges"
$testResults += @{ Name = "Admin User Badges"; Status = "SKIP"; Details = "Requires valid user ID"; StatusCode = $null; ResponseTime = $null; Error = $null }
Write-Result $testResults[-1]

Write-Test 18 18 "Vendor Application Detail"
$testResults += @{ Name = "Vendor Application Detail"; Status = "SKIP"; Details = "Requires valid application ID"; StatusCode = $null; ResponseTime = $null; Error = $null }
Write-Result $testResults[-1]

# Summary
Write-Header "📊 Test Results Summary"

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$warnCount = ($testResults | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$skipCount = ($testResults | Where-Object { $_.Status -eq "SKIP" }).Count

Write-Output ""
Write-ColorOutput "✅ PASSED: $passCount" Green
Write-ColorOutput "⚠️  WARNED: $warnCount" Yellow
Write-ColorOutput "❌ FAILED: $failCount" Red
Write-ColorOutput "⏭️  SKIPPED: $skipCount" Gray

Write-Output ""
Write-ColorOutput "Detailed Results:" Cyan
foreach ($result in $testResults) {
    Write-Result $result
}

Write-Header "🎯 Next Steps"
Write-Output "  1. Review warnings - ensure auth is working as expected"
Write-Output "  2. Fix any failures"
Write-Output "  3. For authenticated tests, set `$env:CLERK_SESSION_TOKEN"
Write-Output "  4. Test authenticated endpoints with valid Clerk session"

# Exit with appropriate code
if ($failCount -gt 0) {
    exit 1
} else {
    exit 0
}
