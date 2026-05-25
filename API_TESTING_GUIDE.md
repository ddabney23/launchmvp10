# API Testing Guide

This guide explains how to test all 18 API routes in the project.

## Quick Start

### Option 1: Node.js/TypeScript (Recommended)

```bash
# Install dependencies (if not already installed)
npm install

# Run tests
npm run test:api

# Or directly with tsx
npx tsx scripts/test-api-routes.ts
```

### Option 2: PowerShell (Windows)

```powershell
# Run PowerShell script
npm run test:api:win

# Or directly
.\scripts\test-api-routes.ps1
```

## Prerequisites

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Verify server is running:**
   - Server should be accessible at `http://localhost:3000`
   - Health check endpoint should respond: `GET /api/health`

## Test Scripts

### 1. TypeScript Test Script (`scripts/test-api-routes.ts`)

**Features:**
- ✅ Reliable on Windows, macOS, and Linux
- ✅ Proper timeout handling (10 seconds per request)
- ✅ Color-coded output
- ✅ Response time tracking
- ✅ JSON response parsing
- ✅ Clerk authentication support

**Usage:**
```bash
# Basic usage
npm run test:api

# With custom base URL
BASE_URL=http://localhost:3001 npm run test:api

# With Clerk session token (for authenticated tests)
CLERK_SESSION_TOKEN=your_token_here npm run test:api
```

**Environment Variables:**
- `BASE_URL` - API base URL (default: `http://localhost:3000`)
- `CLERK_SESSION_TOKEN` - Optional Clerk session token for authenticated tests

### 2. PowerShell Test Script (`scripts/test-api-routes.ps1`)

**Features:**
- ✅ Windows PowerShell compatible
- ✅ Fixed string delimiter issues
- ✅ Proper error handling
- ✅ Color-coded output
- ✅ Response time tracking

**Usage:**
```powershell
# Basic usage
npm run test:api:win

# Or directly
.\scripts\test-api-routes.ps1

# With environment variables
$env:BASE_URL = "http://localhost:3001"
$env:CLERK_SESSION_TOKEN = "your_token_here"
.\scripts\test-api-routes.ps1
```

## Test Coverage

The test suite covers all 18 API routes:

### Public Endpoints
1. ✅ `GET /api/health` - Health check (public)

### Authenticated Endpoints (Require Clerk Auth)
2. ✅ `POST /api/upload` - File upload
3. ✅ `POST /api/vendor/verify` - Vendor verification
4. ✅ `POST /api/gamification/update` - Update user points
5. ✅ `POST /api/bookings/create` - Create booking
6. ✅ `PATCH /api/bookings/update` - Update booking
7. ✅ `POST /api/payment/create-intent` - Create payment intent

### Admin Endpoints (Require Admin Role)
8. ✅ `GET /api/admin/badges` - List badges
9. ✅ `GET /api/admin/users/search` - Search users
10. ✅ `GET /api/admin/users/export` - Export users
11. ✅ `GET /api/vendor/applications` - List vendor applications
12. ✅ `GET /api/webhooks/logs` - Webhook logs

### Webhook Endpoints (Require Signature)
13. ✅ `POST /api/webhooks/clerk` - Clerk webhook
14. ✅ `POST /api/webhooks/stripe` - Stripe webhook

### Dynamic Routes (Skipped - Require IDs)
15. ⏭️ `GET /api/admin/users/[id]` - User detail
16. ⏭️ `GET /api/admin/users/[id]/roles` - User roles
17. ⏭️ `GET /api/admin/users/[id]/badges` - User badges
18. ⏭️ `GET /api/vendor/applications/[id]` - Application detail

## Understanding Test Results

### Status Codes

- ✅ **PASS** - Test passed as expected
- ⚠️ **WARN** - Unexpected but not critical (e.g., endpoint accessible without auth when it should require it)
- ❌ **FAIL** - Test failed (e.g., timeout, connection error)
- ⏭️ **SKIP** - Test skipped (e.g., requires dynamic ID)

### Expected Behaviors

#### Unauthenticated Requests
- Should return `401 Unauthorized` or `403 Forbidden`
- Test scripts verify this behavior

#### Authenticated Requests
- With valid Clerk session token: Should return `200 OK` or appropriate success status
- Without token: Should return `401 Unauthorized`

#### Admin Requests
- Regular users: Should return `403 Forbidden`
- Admin users: Should return `200 OK`

## Clerk Authentication

### How Clerk Auth Works

Clerk uses **cookies** for authentication in Next.js applications. The authentication flow:

1. User logs in via Clerk
2. Clerk sets authentication cookies
3. Browser automatically sends cookies with requests
4. Next.js middleware (`proxy.ts`) validates cookies
5. API routes use `getClerkUserId()` to get authenticated user

### Testing Authenticated Endpoints

#### Option 1: Manual Browser Testing
1. Open browser DevTools
2. Log in to your app
3. Copy session cookies from Application/Storage tab
4. Use cookies in test requests

#### Option 2: Clerk Testing Tokens
1. Get a testing token from Clerk Dashboard
2. Set `CLERK_SESSION_TOKEN` environment variable
3. Run tests with authenticated requests

#### Option 3: Use Browser Extension
- Use tools like Postman or Insomnia
- Import cookies from browser
- Test endpoints manually

### Getting Clerk Session Token

**Method 1: From Browser**
1. Log in to your app
2. Open DevTools → Application → Cookies
3. Find `__session` cookie
4. Copy the value

**Method 2: From Clerk Dashboard**
1. Go to Clerk Dashboard → API Keys
2. Create a testing token
3. Use it in tests

**Method 3: Programmatic (Advanced)**
```typescript
import { clerkClient } from '@clerk/clerk-sdk-node'

const token = await clerkClient.sessions.createToken({
  userId: 'user_xxx',
  expiresInSeconds: 3600,
})
```

## Troubleshooting

### Issue: Tests Hang or Timeout

**Solution:**
- Check if dev server is running: `curl http://localhost:3000/api/health`
- Increase timeout in test script (default: 10 seconds)
- Check network connectivity
- Verify no firewall blocking requests

### Issue: "ParserError: String missing end of string delimiter"

**Solution:**
- Use the TypeScript test script instead: `npm run test:api`
- Or use the fixed PowerShell script: `npm run test:api:win`

### Issue: All Tests Return 401

**Expected Behavior:**
- Without Clerk session token, all authenticated endpoints should return 401
- This confirms authentication is working correctly

**To Test Authenticated Endpoints:**
- Set `CLERK_SESSION_TOKEN` environment variable
- Or test manually in browser after logging in

### Issue: PowerShell Script Fails

**Common Causes:**
1. Execution policy restrictions
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. String encoding issues
   - Use the TypeScript script instead: `npm run test:api`

3. Missing modules
   - Ensure PowerShell 5.1+ is installed
   - Or use the TypeScript script

## Advanced Usage

### Custom Test Configuration

Create a `.env.test` file:
```env
BASE_URL=http://localhost:3000
CLERK_SESSION_TOKEN=your_token_here
```

Load in test script:
```bash
# TypeScript
source .env.test && npm run test:api

# PowerShell
Get-Content .env.test | ForEach-Object { $line = $_ -split '='; Set-Item -Path "env:$($line[0])" -Value $line[1] }
npm run test:api:win
```

### Testing Specific Endpoints

Modify the test script to test only specific endpoints:

```typescript
// In scripts/test-api-routes.ts
// Comment out tests you don't want to run
// Or add a filter:
const testFilter = process.env.TEST_FILTER || 'all'
if (testFilter !== 'all' && !name.includes(testFilter)) {
  return { status: 'SKIP', ... }
}
```

### Continuous Integration

Add to CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Test API Routes
  run: |
    npm run dev &
    sleep 10
    npm run test:api
  env:
    BASE_URL: http://localhost:3000
```

## Best Practices

1. **Always test unauthenticated access first** - Verify security
2. **Test authenticated endpoints separately** - Use valid tokens
3. **Check response times** - Identify slow endpoints
4. **Review warnings** - They may indicate security issues
5. **Test in different environments** - Dev, staging, production

## Next Steps

1. ✅ Run basic tests: `npm run test:api`
2. ✅ Review results and fix any failures
3. ✅ Test authenticated endpoints with valid tokens
4. ✅ Add tests for dynamic routes with valid IDs
5. ✅ Integrate into CI/CD pipeline

---

**Need Help?**
- Check `BACKEND_DEVELOPMENT_PROMPT.md` for API route documentation
- Review `API_ROUTES_AUDIT_COMPLETE.md` for route status
- See `CLERK_MIGRATION_SUMMARY.md` for authentication details

