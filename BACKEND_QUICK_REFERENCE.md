# Backend API Quick Reference Guide

Quick lookup for common backend patterns and API routes.

## 🔐 Authentication

```typescript
import { getClerkUserId } from '@/lib/clerk-auth'

// In route handler
const userId = await getClerkUserId() // Throws if not authenticated
```

## 🗄️ Database Access

```typescript
// Admin operations (bypasses RLS)
import { createAdminClient } from '@/integrations/supabase/server'
const adminClient = createAdminClient()

// User operations (respects RLS)
import { createClientFromRequest } from '@/integrations/supabase/server'
const supabase = createClientFromRequest(req.headers.get('Authorization'))
```

## 📝 Route Template

```typescript
import { NextRequest } from 'next/server'
import { getClerkUserId } from '@/lib/clerk-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { handleApiError, apiSuccess } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    // ... your logic
    return apiSuccess({ data })
  } catch (error) {
    return handleApiError(error)
  }
}
```

## 🛡️ Admin Check

```typescript
const { data: profile } = await adminClient
  .from('profiles')
  .select('is_admin')
  .eq('id', userId)
  .maybeSingle()

if (!profile?.is_admin) {
  return NextResponse.json(
    { error: 'Forbidden. Admin access required.' },
    { status: 403 }
  )
}
```

## ⚠️ Error Helpers

```typescript
import { 
  validationError,
  notFoundError,
  forbiddenError,
  unauthorizedError,
  conflictError
} from '@/lib/api-error'

// Usage
if (!id) validationError('ID is required', 'id')
if (!resource) notFoundError('Resource')
```

## 📦 API Routes

### Admin Routes
- `GET/POST /api/admin/badges`
- `GET/POST/DELETE /api/admin/users/[id]/badges`
- `GET/PATCH /api/admin/users/[id]/roles`
- `GET/PATCH /api/admin/users/[id]`
- `GET /api/admin/users/export`
- `GET /api/admin/users/search`

### Vendor Routes
- `POST/GET /api/vendor/verify`
- `GET /api/vendor/applications` (admin)
- `PATCH /api/vendor/applications/[id]` (admin)

### Booking Routes
- `POST/GET /api/bookings/create`
- `PATCH /api/bookings/update`

### Other Routes
- `POST /api/upload` (Supabase Storage)
- `POST /api/gamification/update`
- `POST /api/payment/create-intent`
- `POST /api/webhooks/clerk`
- `POST /api/webhooks/stripe`
- `GET /api/webhooks/logs` (admin)
- `GET /api/health` (public)

## ✅ Checklist

- [ ] `export const dynamic = 'force-dynamic'`
- [ ] `getClerkUserId()` for auth
- [ ] Correct Supabase client
- [ ] Try/catch with `handleApiError()`
- [ ] `.maybeSingle()` for optional queries
- [ ] Admin check on admin routes
- [ ] Proper error messages
- [ ] TypeScript types correct

## 🚫 Don't Do

- ❌ `@/lib/supabase/server` → Use `@/integrations/supabase/server`
- ❌ `@/lib/clerk-server` → Use `@/lib/clerk-auth`
- ❌ `.single()` → Use `.maybeSingle()`
- ❌ Missing `export const dynamic = 'force-dynamic'`
- ❌ AWS S3 → Use Supabase Storage

## 📚 File Locations

- Auth: `src/lib/clerk-auth.ts`
- Supabase: `src/integrations/supabase/server.ts`
- Errors: `lib/api-error.ts`
- Rate Limit: `lib/rate-limit.ts`
- Middleware: `proxy.ts`
- API Routes: `app/api/**/route.ts`

