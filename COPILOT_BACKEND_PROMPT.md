# GitHub Copilot Backend Prompt (Concise Version)

Copy this into GitHub Copilot's instructions or use in chat.

---

I'm working on Optimix, a Next.js 16 social commerce platform. Help me with backend APIs.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Storage), Clerk Auth, Stripe, Upstash Redis, Sentry

**CRITICAL PATTERNS:**

1. **Authentication (ALL protected routes):**
```typescript
import { getClerkUserId } from '@/lib/clerk-auth'
const userId = await getClerkUserId() // Throws if not authenticated
```

2. **Supabase Clients:**
- Admin ops: `createAdminClient()` from `@/integrations/supabase/server` (bypasses RLS)
- User ops: `createClientFromRequest()` from `@/integrations/supabase/server` (respects RLS)
- NEVER use `@/lib/supabase/server` (old path)

3. **Route Template:**
```typescript
import { NextRequest } from 'next/server'
import { getClerkUserId } from '@/lib/clerk-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { handleApiError, apiSuccess } from '@/lib/api-error'

export const dynamic = 'force-dynamic' // REQUIRED

export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    // ... logic
    return apiSuccess({ data })
  } catch (error) {
    return handleApiError(error, { context: 'route name' })
  }
}
```

4. **Admin Check:**
```typescript
const { data: profile } = await adminClient
  .from('profiles')
  .select('is_admin')
  .eq('id', userId)
  .maybeSingle()

if (!profile?.is_admin) {
  return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
}
```

5. **Error Handling:**
- Always use `handleApiError()` from `@/lib/api-error`
- Use helpers: `validationError()`, `notFoundError()`, `forbiddenError()`
- Always wrap in try/catch

**RULES:**
- ✅ Always use `.maybeSingle()` for optional queries (not `.single()`)
- ✅ Always include `export const dynamic = 'force-dynamic'`
- ✅ Admin routes MUST check `is_admin` flag
- ❌ NEVER use AWS S3 (use Supabase Storage only)
- ❌ NEVER use `@/lib/clerk-server` (use `@/lib/clerk-auth`)

**18 API Routes:**
- Admin: `/api/admin/badges`, `/api/admin/users/[id]/*`, `/api/admin/users/export`, `/api/admin/users/search`
- Vendor: `/api/vendor/verify`, `/api/vendor/applications`, `/api/vendor/applications/[id]`
- Bookings: `/api/bookings/create`, `/api/bookings/update`
- Other: `/api/upload`, `/api/gamification/update`, `/api/payment/create-intent`, `/api/webhooks/*`, `/api/health`

**When helping:**
- Fix broken routes following patterns above
- Add new routes using the template
- Debug database issues (check client type, RLS policies)
- Optimize queries (add indexes, pagination, limit fields)
- Ensure security (auth checks, admin verification)
- Maintain type safety (use `@/integrations/supabase/types`)

Prioritize: Security → Error Handling → Type Safety → Performance

