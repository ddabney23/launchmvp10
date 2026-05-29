/**
 * API Routes Test Suite
 *
 * Usage:
 *   npm run test:api          # full run (warnings allowed)
 *   npm run test:api:smoke    # fail on any FAIL
 *
 * Environment:
 *   BASE_URL=http://localhost:3000
 *   TEST_SESSION_COOKIE=sb-... (optional; copy from browser after sign-in)
 */

import { performance } from 'perf_hooks'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || ''
const SMOKE_MODE = process.argv.includes('--smoke') || process.env.API_SMOKE === '1'
const TIMEOUT_MS = 45000

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP'
  statusCode?: number
  responseTime?: number
  details: string
  error?: string
}

const results: TestResult[] = []

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message: string) {
  log('\n' + '='.repeat(60), 'gray')
  log(message, 'cyan')
  log('='.repeat(60), 'gray')
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
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
    useSession?: boolean
  } = {}
): Promise<TestResult> {
  const {
    method = 'GET',
    body,
    expectedStatus,
    requiresAuth = false,
    isPublic = false,
    description,
    useSession = false,
  } = options

  const startTime = performance.now()

  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (useSession && TEST_SESSION_COOKIE) {
      headers['Cookie'] = TEST_SESSION_COOKIE
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: 'include',
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetchWithTimeout(`${BASE_URL}${url}`, fetchOptions)
    const responseTime = Math.round(performance.now() - startTime)
    const statusCode = response.status
    const expectedStatuses = expectedStatus
      ? Array.isArray(expectedStatus)
        ? expectedStatus
        : [expectedStatus]
      : []

    let status: TestResult['status'] = 'PASS'
    let details = description || 'OK'

    if (expectedStatuses.length > 0 && !expectedStatuses.includes(statusCode)) {
      status = 'FAIL'
      details = `Expected ${expectedStatuses.join(' or ')}, got ${statusCode}`
    } else if (isPublic && statusCode >= 200 && statusCode < 300) {
      details = `Public endpoint accessible (${statusCode})`
    } else if (requiresAuth) {
      if (statusCode === 401 || statusCode === 403) {
        details = `Correctly requires auth (${statusCode})`
      } else if (statusCode >= 200 && statusCode < 300) {
        if (useSession && TEST_SESSION_COOKIE) {
          details = `Authenticated request successful (${statusCode})`
        } else {
          status = 'WARN'
          details = `Unexpected success without session (${statusCode})`
        }
      } else if (statusCode === 400 || statusCode === 404 || statusCode === 503) {
        details = `Expected validation/config response (${statusCode})`
      } else {
        status = 'WARN'
        details = `Unexpected status: ${statusCode}`
      }
    } else if (statusCode >= 200 && statusCode < 300) {
      details = `Success (${statusCode})`
    } else if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
      details = `Structured error (${statusCode})`
    } else {
      status = 'WARN'
      details = `Status: ${statusCode}`
    }

    return { name, status, statusCode, responseTime, details }
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime)
    return {
      name,
      status: 'FAIL',
      responseTime,
      details: 'Request failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function checkServer(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/health`, {}, 8000)
    return response.status === 200 || response.status === 503
  } catch {
    return false
  }
}

type TestCase = Parameters<typeof testEndpoint>[2] & { path: string; name: string; method?: string }

const TEST_CASES: TestCase[] = [
  // Public / semi-public
  { name: 'Health Check', path: '/api/health', isPublic: true, expectedStatus: [200, 503] },
  { name: 'Health Cache (dev)', path: '/api/health/cache', isPublic: true, expectedStatus: [200, 404] },
  { name: 'Listings GET', path: '/api/listings', isPublic: true, expectedStatus: [200] },
  { name: 'Ads GET', path: '/api/ads?placement=feed', isPublic: true, expectedStatus: [200] },
  { name: 'Leaderboard GET', path: '/api/leaderboard?limit=5', isPublic: true, expectedStatus: [200] },
  {
    name: 'Stripe Webhook (no sig)',
    path: '/api/webhooks/stripe',
    method: 'POST',
    body: { type: 'payment_intent.succeeded', data: { object: {} } },
    expectedStatus: [400, 401],
  },
  {
    name: 'Shippo Webhook (no sig)',
    path: '/api/webhooks/shippo',
    method: 'POST',
    body: { event: 'track_updated' },
    expectedStatus: [401, 400],
  },
  {
    name: 'Gamification Update (no secret)',
    path: '/api/gamification/update',
    method: 'POST',
    body: { userId: '00000000-0000-0000-0000-000000000001', action: 'post_created' },
    expectedStatus: [403],
  },

  // Auth required (unauthenticated)
  { name: 'Profile Me', path: '/api/profile/me', requiresAuth: true, expectedStatus: [401] },
  { name: 'Posts GET', path: '/api/posts?limit=5', requiresAuth: true, expectedStatus: [401] },
  { name: 'Notifications GET', path: '/api/notifications', requiresAuth: true, expectedStatus: [401] },
  { name: 'Stories GET', path: '/api/stories', requiresAuth: true, expectedStatus: [401] },
  {
    name: 'Profile Update PUT',
    path: '/api/profile/update',
    method: 'PUT',
    body: { bio: 'test' },
    requiresAuth: true,
    expectedStatus: [401],
  },
  {
    name: 'Posts POST',
    path: '/api/posts',
    method: 'POST',
    body: { content: 'test' },
    requiresAuth: true,
    expectedStatus: [401],
  },
  {
    name: 'Orders Multi-Vendor POST',
    path: '/api/orders/create-multi-vendor',
    method: 'POST',
    body: { items: [], shipping_info: {} },
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Payment Intent POST',
    path: '/api/payment/create-intent',
    method: 'POST',
    body: { orderId: '00000000-0000-0000-0000-000000000001', amount: 10 },
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Onboarding Complete POST',
    path: '/api/onboarding/complete',
    method: 'POST',
    body: { userId: '00000000-0000-0000-0000-000000000001' },
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Upload POST',
    path: '/api/upload',
    method: 'POST',
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Bookings Create POST',
    path: '/api/bookings/create',
    method: 'POST',
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Bookings Update PATCH',
    path: '/api/bookings/update',
    method: 'PATCH',
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Vendor Verify POST',
    path: '/api/vendor/verify',
    method: 'POST',
    requiresAuth: true,
    expectedStatus: [401, 400],
  },
  {
    name: 'Vendor Applications GET',
    path: '/api/vendor/applications',
    requiresAuth: true,
    expectedStatus: [401, 403],
  },
  {
    name: 'Vendor Subscriptions GET',
    path: '/api/vendor/subscriptions',
    requiresAuth: true,
    expectedStatus: [401, 400, 404],
  },
  {
    name: 'Reviews GET',
    path: '/api/reviews',
    requiresAuth: true,
    expectedStatus: [401, 400, 405],
  },
  {
    name: 'Webhook Logs GET',
    path: '/api/webhooks/logs',
    requiresAuth: true,
    expectedStatus: [401, 403],
  },

  // Admin
  { name: 'Admin Badges GET', path: '/api/admin/badges', requiresAuth: true, expectedStatus: [401, 403] },
  {
    name: 'Admin Users Search',
    path: '/api/admin/users/search?q=test',
    requiresAuth: true,
    expectedStatus: [401, 403],
  },
  {
    name: 'Admin Users Export',
    path: '/api/admin/users/export',
    requiresAuth: true,
    expectedStatus: [401, 403],
  },
  { name: 'Admin News GET', path: '/api/admin/news', requiresAuth: true, expectedStatus: [401, 403] },

  // Dev-only
  {
    name: 'Dev Profile Status',
    path: '/api/dev/profile-status',
    requiresAuth: true,
    expectedStatus: [401, 404],
  },

  // Authenticated smoke (optional cookie)
  {
    name: 'Profile Me (session)',
    path: '/api/profile/me',
    requiresAuth: true,
    useSession: true,
    expectedStatus: [200, 401, 404],
  },
  {
    name: 'Posts GET (session)',
    path: '/api/posts?limit=5',
    requiresAuth: true,
    useSession: true,
    expectedStatus: [200, 401],
  },
]

async function runTests() {
  logHeader('API Routes Test Suite')
  log(`Base URL: ${BASE_URL}`, 'gray')
  log(`Mode: ${SMOKE_MODE ? 'smoke (fail on FAIL)' : 'full'}`, 'gray')
  if (TEST_SESSION_COOKIE) {
    log('TEST_SESSION_COOKIE provided', 'green')
  } else {
    log('No TEST_SESSION_COOKIE (session smoke tests may WARN)', 'yellow')
  }

  log('\nChecking dev server...', 'yellow')
  if (!(await checkServer())) {
    log('Server not running. Start with: npm run dev', 'red')
    process.exit(1)
  }
  log('Server is running', 'green')

  logHeader('Testing API Endpoints')

  let index = 0
  for (const tc of TEST_CASES) {
    index++
    log(`\n[${index}/${TEST_CASES.length}] ${tc.name}...`, 'cyan')
    const result = await testEndpoint(tc.name, tc.path, {
      method: tc.method,
      body: tc.body,
      expectedStatus: tc.expectedStatus,
      requiresAuth: tc.requiresAuth,
      isPublic: tc.isPublic,
      description: tc.description,
      useSession: tc.useSession,
    })
    results.push(result)
    logResult(result)
  }

  logHeader('Test Results Summary')

  const passCount = results.filter((r) => r.status === 'PASS').length
  const warnCount = results.filter((r) => r.status === 'WARN').length
  const failCount = results.filter((r) => r.status === 'FAIL').length

  log(`\nPASSED: ${passCount}`, 'green')
  log(`WARNED: ${warnCount}`, 'yellow')
  log(`FAILED: ${failCount}`, 'red')

  if (SMOKE_MODE && failCount > 0) {
    process.exit(1)
  }
  process.exit(failCount > 0 ? 1 : 0)
}

function logResult(result: TestResult) {
  const icons = { PASS: 'PASS', FAIL: 'FAIL', WARN: 'WARN', SKIP: 'SKIP' }
  const colorMap = { PASS: 'green', FAIL: 'red', WARN: 'yellow', SKIP: 'gray' } as const
  const time = result.responseTime ? ` (${result.responseTime}ms)` : ''
  const statusCode = result.statusCode ? ` [${result.statusCode}]` : ''
  log(`  ${icons[result.status]} ${result.name}: ${result.details}${statusCode}${time}`, colorMap[result.status])
  if (result.error) log(`     Error: ${result.error}`, 'red')
}

runTests().catch((error) => {
  log(`Fatal error: ${error instanceof Error ? error.message : error}`, 'red')
  process.exit(1)
})
