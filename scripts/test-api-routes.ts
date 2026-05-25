/**
 * API Routes Test Suite
 * 
 * Tests all 18 API routes with proper error handling and Clerk authentication support.
 * 
 * Usage:
 *   npx tsx scripts/test-api-routes.ts
 *   npm run test:api
 * 
 * Environment:
 *   - BASE_URL: API base URL (default: http://localhost:3000)
 *   - CLERK_SESSION_TOKEN: Optional Clerk session token for authenticated tests
 */

import { performance } from 'perf_hooks'

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const CLERK_SESSION_TOKEN = process.env.CLERK_SESSION_TOKEN || ''
const TIMEOUT_MS = 10000 // 10 seconds

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

// Test result interface
interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP'
  statusCode?: number
  responseTime?: number
  details: string
  error?: string
}

const results: TestResult[] = []

// Helper functions
function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message: string) {
  log('\n' + '='.repeat(60), 'gray')
  log(message, 'cyan')
  log('='.repeat(60), 'gray')
}

function logTest(index: number, total: number, name: string) {
  log(`\n[${index}/${total}] Testing ${name}...`, 'cyan')
}

function logResult(result: TestResult) {
  const icons = {
    PASS: '✅',
    FAIL: '❌',
    WARN: '⚠️ ',
    SKIP: '⏭️ ',
  }
  const colorMap = {
    PASS: 'green',
    FAIL: 'red',
    WARN: 'yellow',
    SKIP: 'gray',
  } as const

  const icon = icons[result.status]
  const color = colorMap[result.status]
  const time = result.responseTime ? ` (${result.responseTime}ms)` : ''
  const statusCode = result.statusCode ? ` [${result.statusCode}]` : ''

  log(`  ${icon} ${result.name}: ${result.details}${statusCode}${time}`, color)
  if (result.error) {
    log(`     Error: ${result.error}`, 'red')
  }
}

// Fetch wrapper with timeout and error handling
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

// Test helper function
async function testEndpoint(
  name: string,
  url: string,
  options: {
    method?: string
    body?: unknown
    expectedStatus?: number | number[]
    requiresAuth?: boolean
    isPublic?: boolean
    description?: string
  } = {}
): Promise<TestResult> {
  const {
    method = 'GET',
    body,
    expectedStatus,
    requiresAuth = false,
    isPublic = false,
    description,
  } = options

  const startTime = performance.now()

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add Clerk session token if provided and auth is required
    if (requiresAuth && CLERK_SESSION_TOKEN) {
      // Clerk uses cookies, but we can also try Authorization header for testing
      headers['Authorization'] = `Bearer ${CLERK_SESSION_TOKEN}`
      // Note: In production, Clerk uses cookies set by the browser
      // For testing, you may need to use Clerk's testing tokens or session cookies
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: 'include', // Include cookies for Clerk auth
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetchWithTimeout(`${BASE_URL}${url}`, fetchOptions)
    const responseTime = Math.round(performance.now() - startTime)

    let responseData: unknown
    try {
      const text = await response.text()
      responseData = text ? JSON.parse(text) : null
    } catch {
      responseData = null
    }

    const statusCode = response.status
    const expectedStatuses = expectedStatus
      ? Array.isArray(expectedStatus)
        ? expectedStatus
        : [expectedStatus]
      : []

    // Determine test result
    let status: TestResult['status'] = 'PASS'
    let details = description || 'OK'

    if (expectedStatuses.length > 0 && !expectedStatuses.includes(statusCode)) {
      status = 'FAIL'
      details = `Expected status ${expectedStatuses.join(' or ')}, got ${statusCode}`
    } else if (isPublic && statusCode >= 200 && statusCode < 300) {
      details = `Public endpoint accessible (${statusCode})`
    } else if (requiresAuth) {
      if (statusCode === 401 || statusCode === 403) {
        details = `Correctly requires authentication (${statusCode})`
      } else if (statusCode >= 200 && statusCode < 300) {
        if (CLERK_SESSION_TOKEN) {
          details = `Authenticated request successful (${statusCode})`
        } else {
          status = 'WARN'
          details = `Unexpected success without auth token (${statusCode})`
        }
      } else if (statusCode === 400) {
        details = `Request validation error (expected for missing/invalid body)`
      } else {
        status = 'WARN'
        details = `Unexpected status: ${statusCode}`
      }
    } else if (statusCode >= 200 && statusCode < 300) {
      details = `Success (${statusCode})`
    } else {
      status = 'WARN'
      details = `Status: ${statusCode}`
    }

    return {
      name,
      status,
      statusCode,
      responseTime,
      details,
    }
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime)
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      name,
      status: 'FAIL',
      responseTime,
      details: 'Request failed',
      error: errorMessage,
    }
  }
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/health`, {}, 5000)
    return response.ok
  } catch {
    return false
  }
}

// Main test suite
async function runTests() {
  logHeader('🧪 API Routes Test Suite')
  log(`Base URL: ${BASE_URL}`, 'gray')
  if (CLERK_SESSION_TOKEN) {
    log('Clerk session token provided (authenticated tests enabled)', 'green')
  } else {
    log('No Clerk session token (testing unauthenticated access only)', 'yellow')
  }

  // Check server
  log('\n🔍 Checking if dev server is running...', 'yellow')
  const serverRunning = await checkServer()
  if (!serverRunning) {
    log('❌ Server not running! Please start with: npm run dev', 'red')
    log('\nAttempting to start server...', 'yellow')
    log('⚠️  Please start the server manually and run tests again', 'yellow')
    process.exit(1)
  }
  log('✅ Server is running', 'green')

  logHeader('📋 Testing API Endpoints')

  // Test 1: Health Check (Public)
  logTest(1, 18, 'Health Check')
  results.push(
    await testEndpoint('Health Check', '/api/health', {
      isPublic: true,
      expectedStatus: [200, 503],
      description: 'Public health endpoint',
    })
  )
  logResult(results[results.length - 1])

  // Test 2: Upload (Requires Auth)
  logTest(2, 18, 'Upload (No Auth)')
  results.push(
    await testEndpoint('Upload (No Auth)', '/api/upload', {
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 400],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 3: Clerk Webhook (Requires Signature)
  logTest(3, 18, 'Clerk Webhook (No Signature)')
  results.push(
    await testEndpoint('Clerk Webhook', '/api/webhooks/clerk', {
      method: 'POST',
      body: { type: 'user.created', data: { id: 'test' } },
      expectedStatus: [400, 401],
      description: 'Should validate webhook signature',
    })
  )
  logResult(results[results.length - 1])

  // Test 4: Stripe Webhook (Requires Signature)
  logTest(4, 18, 'Stripe Webhook (No Signature)')
  results.push(
    await testEndpoint('Stripe Webhook', '/api/webhooks/stripe', {
      method: 'POST',
      body: { type: 'payment_intent.succeeded', data: { object: {} } },
      expectedStatus: [400, 401],
      description: 'Should validate webhook signature',
    })
  )
  logResult(results[results.length - 1])

  // Test 5: Webhook Logs (Requires Auth)
  logTest(5, 18, 'Webhook Logs')
  results.push(
    await testEndpoint('Webhook Logs', '/api/webhooks/logs', {
      requiresAuth: true,
      expectedStatus: [401, 403],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 6: Vendor Applications (Requires Admin)
  logTest(6, 18, 'Vendor Applications')
  results.push(
    await testEndpoint('Vendor Applications', '/api/vendor/applications', {
      requiresAuth: true,
      expectedStatus: [401, 403],
      description: 'Should require admin authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 7: Vendor Verify (Requires Auth)
  logTest(7, 18, 'Vendor Verify')
  results.push(
    await testEndpoint('Vendor Verify', '/api/vendor/verify', {
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 400],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 8: Gamification Update (Requires Auth)
  logTest(8, 18, 'Gamification Update')
  results.push(
    await testEndpoint('Gamification Update', '/api/gamification/update', {
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 400],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 9: Bookings Create (Requires Auth)
  logTest(9, 18, 'Bookings Create')
  results.push(
    await testEndpoint('Bookings Create', '/api/bookings/create', {
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 400],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 10: Bookings Update (Requires Auth)
  logTest(10, 18, 'Bookings Update')
  results.push(
    await testEndpoint('Bookings Update', '/api/bookings/update', {
      method: 'PATCH',
      requiresAuth: true,
      expectedStatus: [401, 400],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 11: Payment Create Intent (Requires Auth)
  logTest(11, 18, 'Payment Create Intent')
  results.push(
    await testEndpoint('Payment Create Intent', '/api/payment/create-intent', {
      method: 'POST',
      requiresAuth: true,
      expectedStatus: [401, 400],
      description: 'Should require authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 12: Admin Badges (Requires Admin)
  logTest(12, 18, 'Admin Badges')
  results.push(
    await testEndpoint('Admin Badges', '/api/admin/badges', {
      requiresAuth: true,
      expectedStatus: [401, 403],
      description: 'Should require admin authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 13: Admin Users Search (Requires Admin)
  logTest(13, 18, 'Admin Users Search')
  results.push(
    await testEndpoint('Admin Users Search', '/api/admin/users/search?q=test', {
      requiresAuth: true,
      expectedStatus: [401, 403],
      description: 'Should require admin authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 14: Admin Users Export (Requires Admin)
  logTest(14, 18, 'Admin Users Export')
  results.push(
    await testEndpoint('Admin Users Export', '/api/admin/users/export', {
      requiresAuth: true,
      expectedStatus: [401, 403],
      description: 'Should require admin authentication',
    })
  )
  logResult(results[results.length - 1])

  // Test 15-18: Dynamic routes (skipped - require IDs)
  logTest(15, 18, 'Admin User Detail')
  results.push({
    name: 'Admin User Detail',
    status: 'SKIP',
    details: 'Requires valid user ID',
  })
  logResult(results[results.length - 1])

  logTest(16, 18, 'Admin User Roles')
  results.push({
    name: 'Admin User Roles',
    status: 'SKIP',
    details: 'Requires valid user ID',
  })
  logResult(results[results.length - 1])

  logTest(17, 18, 'Admin User Badges')
  results.push({
    name: 'Admin User Badges',
    status: 'SKIP',
    details: 'Requires valid user ID',
  })
  logResult(results[results.length - 1])

  logTest(18, 18, 'Vendor Application Detail')
  results.push({
    name: 'Vendor Application Detail',
    status: 'SKIP',
    details: 'Requires valid application ID',
  })
  logResult(results[results.length - 1])

  // Summary
  logHeader('📊 Test Results Summary')

  const passCount = results.filter((r) => r.status === 'PASS').length
  const warnCount = results.filter((r) => r.status === 'WARN').length
  const failCount = results.filter((r) => r.status === 'FAIL').length
  const skipCount = results.filter((r) => r.status === 'SKIP').length

  log(`\n✅ PASSED: ${passCount}`, 'green')
  log(`⚠️  WARNED: ${warnCount}`, 'yellow')
  log(`❌ FAILED: ${failCount}`, 'red')
  log(`⏭️  SKIPPED: ${skipCount}`, 'gray')

  log('\nDetailed Results:', 'cyan')
  results.forEach((result) => {
    logResult(result)
  })

  logHeader('🎯 Next Steps')
  log('  1. Review warnings - ensure auth is working as expected', 'gray')
  log('  2. Fix any failures', 'gray')
  log('  3. For authenticated tests, set CLERK_SESSION_TOKEN env var', 'gray')
  log('  4. Test authenticated endpoints with valid Clerk session', 'gray')

  // Exit with appropriate code
  if (failCount > 0) {
    process.exit(1)
  } else if (warnCount > 0) {
    process.exit(0) // Warnings don't fail the test suite
  } else {
    process.exit(0)
  }
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red')
  if (error.stack) {
    log(error.stack, 'red')
  }
  process.exit(1)
})

