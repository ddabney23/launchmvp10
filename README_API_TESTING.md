# API Testing - Quick Start Guide

## 🚀 Quick Start

### 1. Start Your Dev Server
```bash
npm run dev
```

### 2. Run Tests (Choose One)

**Option A: TypeScript (Recommended - Works on All Platforms)**
```bash
npm run test:api
```

**Option B: PowerShell (Windows Only)**
```bash
npm run test:api:win
```

## ✅ What Gets Tested

The test suite automatically tests all 18 API routes:

- ✅ Health check endpoint
- ✅ Authentication requirements (401/403 checks)
- ✅ Admin-only endpoints
- ✅ Webhook signature validation
- ✅ Response times
- ✅ Error handling

## 📊 Understanding Results

- ✅ **PASS** - Endpoint working correctly
- ⚠️ **WARN** - Unexpected behavior (review needed)
- ❌ **FAIL** - Endpoint failed or timed out
- ⏭️ **SKIP** - Test skipped (requires dynamic IDs)

## 🔐 Testing Authenticated Endpoints

By default, tests verify that endpoints **require authentication** (return 401/403).

To test with authentication:

1. **Get Clerk Session Token:**
   - Log in to your app in browser
   - Open DevTools → Application → Cookies
   - Copy `__session` cookie value

2. **Run Tests with Token:**
   ```bash
   # TypeScript
   CLERK_SESSION_TOKEN=your_token npm run test:api
   
   # PowerShell
   $env:CLERK_SESSION_TOKEN = "your_token"
   npm run test:api:win
   ```

## 🐛 Troubleshooting

### Tests Hang or Timeout
- ✅ Check if dev server is running: `curl http://localhost:3000/api/health`
- ✅ Increase timeout in script (default: 10 seconds)

### PowerShell Errors
- ✅ Use TypeScript version instead: `npm run test:api`
- ✅ Or fix execution policy: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

### All Tests Return 401
- ✅ **This is expected!** Without auth token, endpoints should return 401
- ✅ This confirms your authentication is working correctly

## 📚 Full Documentation

See `API_TESTING_GUIDE.md` for complete documentation.

---

**Ready to test?** Just run `npm run test:api` after starting your dev server! 🎉

