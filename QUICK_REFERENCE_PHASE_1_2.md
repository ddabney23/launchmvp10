# Phase 1 & 2 Quick Reference

## 🚀 Start Development Server
```bash
npm run dev
# Visit: http://localhost:3000
```

## 🔑 Authentication Flow

### Sign Up
1. User visits `/sign-up`
2. Clerk handles registration
3. Webhook syncs user to Supabase profiles table
4. User redirected to `/onboarding`

### Sign In
1. User visits `/sign-in`
2. Clerk authenticates
3. Session created with role data
4. User redirected to `/home`

### Protected Routes
- `/admin/*` → Requires admin role
- `/vendor/*` → Requires verified vendor
- Everything else → Requires authentication (except public routes)

## 🛡️ Security Features

### Rate Limits
```typescript
// In any API route
import { checkRateLimit } from '@/lib/rate-limit'

const { success } = await checkRateLimit(userId, 'api')
if (!success) return 429 error
```

### Session Checks
```typescript
import { getSession, requireAdmin } from '@/lib/session'

// Optional authentication
const session = await getSession()
if (!session) return <SignIn />

// Require authentication
const user = await getSessionOrThrow()

// Require admin
const admin = await requireAdmin()

// Require vendor
const vendor = await requireVerifiedVendor()
```

## 📝 Environment Variables

### Required
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
DATABASE_URL=
```

### Testing
```bash
npx tsx scripts/test-connections.ts
```

## 🔧 Common Tasks

### Add Admin Role
In Clerk Dashboard:
1. Users → Select user
2. Metadata → Public metadata
3. Add: `{ "role": "admin" }`

### Add Vendor Status
```typescript
import { updateSessionMetadata } from '@/lib/session'

await updateSessionMetadata({
  isVendor: true,
  vendorVerified: true,
  role: 'vendor'
})
```

### Check User Role
```typescript
const session = await getSession()

if (session?.isAdmin) {
  // Admin actions
}

if (session?.isVendor && session?.vendorVerified) {
  // Vendor actions
}
```

## 🐛 Troubleshooting

### "Unauthorized" Error
- Check user is signed in
- Verify Clerk keys in `.env.local`
- Clear cookies and sign in again

### "Rate Limit Exceeded"
- Wait 10 seconds (default limit: 100 req/10s)
- Or increase limit in `middleware.ts`

### "Admin Access Required"
- Add admin role in Clerk dashboard
- User metadata: `{ "role": "admin" }`

### Database Connection Failed
- Verify Supabase project is active
- Check DATABASE_URL is correct
- Run migrations: See Supabase Dashboard

## 📚 API Routes

### Protected API Route
```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrThrow } from '@/lib/session'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Require authentication
  const session = await getSessionOrThrow()
  
  // Check rate limit
  const { success } = await checkRateLimit(session.id, 'api')
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
  
  // Your logic here
  return NextResponse.json({ data: 'success' })
}
```

### Admin-Only API Route
```typescript
import { requireAdmin } from '@/lib/session'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  
  // Admin-only logic
  return NextResponse.json({ success: true })
}
```

## 🔒 Security Headers

All responses include:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy
- HSTS (production only)

## 📊 Monitoring

### Check Rate Limit Stats
Redis stores analytics for all rate limits. Access via Upstash dashboard.

### View Session Data
```typescript
const session = await getSession()
console.log({
  id: session?.id,
  role: session?.role,
  isAdmin: session?.isAdmin,
  isVendor: session?.isVendor,
})
```

---

**Status**: Phase 1 & 2 Complete ✅  
**Next**: Fix database connection, then start Phase 3
