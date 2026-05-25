# Optimix Backend Development Assistant Prompt

Copy this entire prompt into Cursor or GitHub Copilot to get AI assistance with backend development.

---

You are helping me develop and maintain the backend APIs for Optimix, a Next.js 16 social commerce platform. Follow these guidelines strictly.

## 🏗️ Project Architecture

**Tech Stack:**
- Next.js 16 (App Router) + TypeScript
- Supabase (PostgreSQL database + Storage)
- Clerk Authentication (NOT Supabase Auth)
- Stripe Payments
- Upstash Redis (Rate Limiting)
- Sentry (Error Tracking)

**Key Files:**
- API Routes: `app/api/**/route.ts`
- Auth Helpers: `src/lib/clerk-auth.ts`
- Supabase Server: `src/integrations/supabase/server.ts`
- Error Handling: `lib/api-error.ts`
- Rate Limiting: `lib/rate-limit.ts`
- Middleware: `proxy.ts`

## 🔐 Authentication Pattern (REQUIRED)

**For ALL protected API routes:**
```typescript
import { getClerkUserId } from '@/lib/clerk-auth'

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user ID (throws if not authenticated)
    const userId = await getClerkUserId()
    
    // ... rest of handler
  } catch (error) {
    return handleApiError(error)
  }
}
```

**Available Auth Functions:**
- `getClerkUserId()` - Returns userId, throws if not authenticated
- `getClerkUser()` - Returns user object or null
- `getClerkUserOrThrow()` - Returns user object, throws if not authenticated
- `isAuthenticated()` - Returns boolean

## 🗄️ Database Access Patterns

**1. Admin Operations (Bypasses RLS):**
```typescript
import { createAdminClient } from '@/integrations/supabase/server'

const adminClient = createAdminClient()
const { data, error } = await adminClient
  .from('table_name')
  .select('*')
```

**2. User-Scoped Operations (Respects RLS):**
```typescript
import { createClientFromRequest } from '@/integrations/supabase/server'

const supabase = createClientFromRequest(req.headers.get('Authorization'))
const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

**⚠️ CRITICAL:**
- Use `createAdminClient()` for admin routes and operations that need to bypass RLS
- Use `createClientFromRequest()` for user operations
- NEVER use `@/lib/supabase/server` (old import path)
- Always use `.maybeSingle()` for optional queries (not `.single()`)

## 📝 API Route Template

**Standard Route Structure:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getClerkUserId } from '@/lib/clerk-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { handleApiError, apiSuccess, validationError, notFoundError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic' // REQUIRED

// Define validation schema
const GetResourceSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    
    // Parse query params
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    
    // Validation
    if (!id) {
      validationError('ID is required', 'id')
    }
    
    // Validate with Zod (optional but recommended)
    const validated = GetResourceSchema.parse({ id })
    
    // Database query
    const { data, error } = await adminClient
      .from('table_name')
      .select('*')
      .eq('id', validated.id)
      .maybeSingle()
    
    if (error) {
      logger.error('Database error', error, { id: validated.id, userId })
      throw error
    }
    
    if (!data) {
      notFoundError('Resource')
    }
    
    logger.info('Resource fetched successfully', { id: validated.id, userId })
    return apiSuccess({ data })
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/route', userId })
  }
}
```

**POST Route with Request Body:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    
    // Parse and validate request body
    const body = await req.json()
    const CreateResourceSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    })
    
    const validated = CreateResourceSchema.parse(body)
    
    // Database insert
    const { data, error } = await adminClient
      .from('table_name')
      .insert({
        ...validated,
        user_id: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to create resource', error, { validated, userId })
      throw error
    }
    
    logger.info('Resource created', { id: data.id, userId })
    return apiSuccess({ data }, 201)
  } catch (error) {
    return handleApiError(error, { context: 'POST /api/route', userId })
  }
}
```

## 🛡️ Admin Route Pattern

**For admin-only routes:**
```typescript
export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    
    // Check admin status
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
    
    // Admin logic here
    return apiSuccess({ data: result })
  } catch (error) {
    return handleApiError(error)
  }
}
```

## ⚠️ Error Handling

**Always use standardized error handling:**
```typescript
import { 
  handleApiError, 
  apiSuccess,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError
} from '@/lib/api-error'
import { logger } from '@/lib/logger'

// In route handler:
try {
  // ... logic
} catch (error) {
  // handleApiError automatically:
  // - Logs to console
  // - Sends to Sentry with context
  // - Returns proper error response
  return handleApiError(error, { 
    context: 'route name',
    userId,
    // ... other context
  })
}

// For specific errors (these throw ApiError):
if (!requiredField) {
  validationError('Field is required', 'fieldName')
}

if (!resource) {
  notFoundError('Resource name')
}

// Manual error logging (when needed):
logger.error('Operation failed', error, { 
  userId, 
  resourceId,
  operation: 'create'
})
```

**Error Response Format:**
```typescript
// Success
{ data: {...} }

// Error
{ 
  error: "Error message",
  code: "ERROR_CODE",
  field?: "fieldName" // for validation errors
}
```

## 📦 Existing API Routes Reference

**Admin Routes (6):**
- `GET/POST /api/admin/badges` - Badge management
- `GET/POST/DELETE /api/admin/users/[id]/badges` - User badges
- `GET/PATCH /api/admin/users/[id]/roles` - User roles
- `GET/PATCH /api/admin/users/[id]` - User management
- `GET /api/admin/users/export` - Export users
- `GET /api/admin/users/search` - Search users

**Vendor Routes (3):**
- `POST/GET /api/vendor/verify` - Vendor verification
- `GET /api/vendor/applications` - List applications (admin)
- `PATCH /api/vendor/applications/[id]` - Approve/deny (admin)

**Booking Routes (2):**
- `POST/GET /api/bookings/create` - Create/list bookings
- `PATCH /api/bookings/update` - Update booking

**Other Routes (7):**
- `POST /api/upload` - File upload (Supabase Storage)
- `POST /api/gamification/update` - Points system
- `POST /api/payment/create-intent` - Stripe payments
- `POST /api/webhooks/clerk` - Clerk webhooks
- `POST /api/webhooks/stripe` - Stripe webhooks
- `GET /api/webhooks/logs` - Webhook logs (admin)
- `GET /api/health` - Health check (no auth)

## ✅ Mandatory Checklist for Every Route

**Structure:**
- [ ] `export const dynamic = 'force-dynamic'` present
- [ ] Proper HTTP method (GET, POST, PATCH, DELETE)
- [ ] Route file in correct location (`app/api/**/route.ts`)

**Authentication:**
- [ ] Uses `getClerkUserId()` for authentication (if protected)
- [ ] Webhook routes skip authentication (verify signature instead)
- [ ] Public routes explicitly documented

**Database:**
- [ ] Uses correct Supabase client (`createAdminClient` vs `createClientFromRequest`)
- [ ] Uses `.maybeSingle()` for optional queries (not `.single()`)
- [ ] Handles Supabase error codes properly
- [ ] Checks ownership for user-scoped operations

**Validation:**
- [ ] Request body validated with Zod schema
- [ ] Query parameters validated
- [ ] File uploads validated (type, size, bucket)

**Error Handling:**
- [ ] Wrapped in try/catch with `handleApiError()`
- [ ] Uses error helpers (`validationError`, `notFoundError`, etc.)
- [ ] Logs errors with context using `logger.error()`
- [ ] Returns proper status codes

**Security:**
- [ ] Admin routes check `is_admin` flag
- [ ] User routes verify ownership
- [ ] Input sanitized and validated
- [ ] File uploads restricted to allowed buckets

**Code Quality:**
- [ ] TypeScript types are correct
- [ ] Uses `logger` instead of `console.log`
- [ ] Proper error messages (user-friendly)
- [ ] Code follows existing patterns

## 🚫 Common Mistakes to Avoid

1. ❌ Using `@/lib/supabase/server` (use `@/integrations/supabase/server`)
2. ❌ Using `@/lib/clerk-server` (use `@/lib/clerk-auth`)
3. ❌ Missing `export const dynamic = 'force-dynamic'`
4. ❌ Using `.single()` without error handling (use `.maybeSingle()`)
5. ❌ Not checking admin status on admin routes
6. ❌ Missing try/catch blocks
7. ❌ Not using `handleApiError()` for error responses
8. ❌ Using AWS S3 (project uses Supabase Storage only)
9. ❌ Hardcoding error messages (use error helpers)
10. ❌ Missing validation for required fields

## 🗃️ Database Query Patterns

**Common Supabase Query Patterns:**
```typescript
// Select with specific fields
const { data } = await adminClient
  .from('profiles')
  .select('id, username, email, avatar_url')
  .eq('id', userId)
  .maybeSingle()

// Select with joins
const { data } = await adminClient
  .from('posts')
  .select(`
    *,
    profiles:user_id (
      id,
      username,
      avatar_url
    ),
    comments (
      id,
      content,
      created_at
    )
  `)
  .eq('id', postId)
  .maybeSingle()

// Filtering
const { data } = await adminClient
  .from('listings')
  .select('*')
  .eq('status', 'active')
  .gte('price', minPrice)
  .lte('price', maxPrice)
  .order('created_at', { ascending: false })
  .limit(10)

// Count
const { count } = await adminClient
  .from('orders')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)

// Insert with return
const { data, error } = await adminClient
  .from('resources')
  .insert({ name, user_id: userId })
  .select()
  .single()

// Update
const { data, error } = await adminClient
  .from('resources')
  .update({ name: newName })
  .eq('id', resourceId)
  .eq('user_id', userId) // Security: ensure ownership
  .select()
  .single()

// Delete
const { error } = await adminClient
  .from('resources')
  .delete()
  .eq('id', resourceId)
  .eq('user_id', userId) // Security: ensure ownership
```

**Error Codes to Handle:**
- `PGRST116` - No rows returned (use `.maybeSingle()` to handle gracefully)
- `23505` - Unique constraint violation
- `23503` - Foreign key constraint violation
- `42501` - Insufficient privileges (RLS policy violation)

## 🔷 Type Safety Patterns

**Using Database Types:**
```typescript
import type { Database } from '@/integrations/supabase/types'

// Type-safe table access
type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// In route handler
const { data } = await adminClient
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .maybeSingle()

// data is typed as Profile | null
if (data) {
  // TypeScript knows all Profile fields
  console.log(data.username, data.email)
}
```

**Zod Schema Validation:**
```typescript
import { z } from 'zod'

// Define schema matching database structure
const CreatePostSchema = z.object({
  content: z.string().min(1).max(5000),
  media_urls: z.array(z.string().url()).optional(),
  is_public: z.boolean().default(true),
})

// Infer TypeScript type from schema
type CreatePostInput = z.infer<typeof CreatePostSchema>

// Use in route
const validated = CreatePostSchema.parse(body)
// validated is typed as CreatePostInput
```

## 🧪 Testing Patterns

**Testing API Routes:**
```typescript
// Example test structure
describe('POST /api/resource', () => {
  it('should create resource with valid data', async () => {
    const response = await fetch('/api/resource', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        name: 'Test Resource',
      }),
    })
    
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.data).toHaveProperty('id')
  })
  
  it('should return 401 without authentication', async () => {
    const response = await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })
    
    expect(response.status).toBe(401)
  })
})
```

## 🔧 When I Ask You To:

**Fix a broken API route:**
1. Check authentication pattern (`getClerkUserId()`)
2. Verify Supabase client usage (admin vs user-scoped)
3. Check error handling (`handleApiError()`)
4. Verify database query syntax and error codes
5. Test with proper request format
6. Check TypeScript types match database schema
7. Verify logger usage for debugging

**Add a new API route:**
1. Follow the standard route template
2. Use appropriate authentication
3. Choose correct Supabase client
4. Add Zod validation schema
5. Implement error handling
6. Add logging for important operations
7. Add to route list above
8. Test all error cases

**Debug a database issue:**
1. Check if using correct client (admin vs user-scoped)
2. Verify RLS policies if using user-scoped client
3. Check query syntax and types
4. Verify table/column names match schema
5. Check for null/undefined handling
6. Look at Supabase error codes (PGRST116, etc.)
7. Use logger to trace query execution

**Optimize performance:**
1. Add database indexes if needed
2. Use `.select()` to limit returned fields (not `select('*')`)
3. Add pagination for list endpoints
4. Use `.range()` for pagination
5. Cache frequently accessed data
6. Optimize N+1 queries with joins
7. Use `.head()` for count-only queries

## 📤 Request/Response Patterns

**Parsing Request Body:**
```typescript
// JSON body
const body = await req.json()

// Form data
const formData = await req.formData()
const file = formData.get('file') as File
const field = formData.get('field') as string

// Query parameters
const { searchParams } = new URL(req.url)
const id = searchParams.get('id')
const page = parseInt(searchParams.get('page') || '1')
const limit = parseInt(searchParams.get('limit') || '10')
```

**Validation with Zod:**
```typescript
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(18).optional(),
})

// Parse and validate
try {
  const validated = CreateSchema.parse(body)
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 }
    )
  }
}
```

## 📁 File Upload Pattern

**File Upload Route:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string
    
    // Validate bucket (security)
    const allowedBuckets = ['vendor-assets', 'vendor-docs', 'listings', 'avatars', 'posts']
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json(
        { error: 'Invalid bucket name' },
        { status: 400 }
      )
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }
    
    // Create unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 9)
    const extension = file.name.split('.').pop()
    const uniqueFilename = `${timestamp}-${randomId}.${extension}`
    const userPath = `${userId}/${uniqueFilename}`
    
    // Convert to Uint8Array
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Upload to Supabase Storage
    const { data, error } = await adminClient.storage
      .from(bucket)
      .upload(userPath, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })
    
    if (error) {
      logger.error('File upload error', error, { bucket, path: userPath, userId })
      throw error
    }
    
    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from(bucket)
      .getPublicUrl(data.path)
    
    return NextResponse.json({
      success: true,
      path: data.path,
      url: publicUrl,
    })
  } catch (error) {
    return handleApiError(error, { context: 'POST /api/upload' })
  }
}
```

## 🔔 Webhook Pattern

**Webhook Route (No Auth Required):**
```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')
    
    if (!sig) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      )
    }
    
    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
      logger.error('Webhook signature verification failed', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }
    
    // Handle event
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Handle success
        break
      case 'payment_intent.payment_failed':
        // Handle failure
        break
      default:
        logger.warn('Unhandled webhook event', { type: event.type })
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    return handleApiError(error, { context: 'POST /api/webhooks/stripe' })
  }
}
```

## 📄 Pagination Pattern

**Paginated List Endpoint:**
```typescript
export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Max 100
    const offset = (page - 1) * limit
    
    // Get total count
    const { count, error: countError } = await adminClient
      .from('table_name')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      logger.error('Failed to get count', countError)
      throw countError
    }
    
    // Get paginated data
    const { data, error } = await adminClient
      .from('table_name')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      logger.error('Failed to fetch data', error)
      throw error
    }
    
    return apiSuccess({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    })
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/route' })
  }
}
```

## 📊 Logging Patterns

**Logger Usage:**
```typescript
import { logger } from '@/lib/logger'

// Error logging (with context)
logger.error('Operation failed', error, {
  userId,
  resourceId,
  operation: 'create',
})

// Info logging
logger.info('Resource created', { id: data.id, userId })

// Warning logging
logger.warn('Rate limit approaching', { userId, requests: 58 })

// Debug logging (development only)
logger.debug('Query executed', { query, params })
```

**Logger automatically:**
- Logs to console in all environments
- Sends to Sentry in production
- Includes context in error tracking

## 🔒 Security Best Practices

1. **Always validate input:**
   - Use Zod schemas for request validation
   - Sanitize user input
   - Validate file types and sizes

2. **Check ownership:**
   ```typescript
   // Verify user owns the resource
   const { data: resource } = await supabase
     .from('resources')
     .select('user_id')
     .eq('id', resourceId)
     .maybeSingle()
   
   if (!resource || resource.user_id !== userId) {
     return NextResponse.json(
       { error: 'Forbidden' },
       { status: 403 }
     )
   }
   ```

3. **Use parameterized queries:**
   - Supabase handles this automatically
   - Never concatenate user input into queries

4. **Rate limiting:**
   - Handled automatically in middleware
   - Different limits for different operations

## 📚 Additional Context

- **Storage:** All files use Supabase Storage buckets (vendor-assets, vendor-docs, listings, avatars, posts)
- **Rate Limiting:** Handled automatically in `proxy.ts` middleware
- **Webhooks:** Clerk and Stripe webhooks don't require authentication
- **Health Check:** `/api/health` is public (no auth)
- **Type Safety:** Use types from `@/integrations/supabase/types`
- **Logger:** Use `logger` from `@/lib/logger` (not console.log)
- **Validation:** Use Zod schemas for all input validation
- **Error Tracking:** Sentry integration via `handleApiError()` and `logger.error()`

**Always prioritize:**
1. Security (proper auth checks, input validation, ownership verification)
2. Error handling (never expose internal errors, use handleApiError)
3. Type safety (TypeScript strict mode, Zod validation)
4. Code consistency (follow existing patterns)
5. Performance (optimize queries, add pagination, use indexes)
6. Logging (log important events and errors with context)

Help me build robust, secure, and maintainable backend APIs!

---

## Usage Instructions

### For Cursor:
1. Open Cursor Settings
2. Go to "Features" → "Rules for AI"
3. Paste this entire prompt
4. Save and restart Cursor

### For GitHub Copilot:
1. Create a `.copilot/instructions.md` file in your project root
2. Paste this entire prompt
3. Copilot will use it automatically

### For Chat/Inline Suggestions:
Simply copy and paste the relevant sections when asking questions or requesting code generation.

---

## 💡 Real-World Examples

### Example 1: Complete CRUD Route
```typescript
import { NextRequest } from 'next/server'
import { getClerkUserId } from '@/lib/clerk-auth'
import { createClientFromRequest } from '@/integrations/supabase/server'
import { handleApiError, apiSuccess, validationError, notFoundError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
})

const UpdateSchema = CreateSchema.partial()

// GET - List resources
export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const supabase = createClientFromRequest(req.headers.get('Authorization'))
    
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
    const offset = (page - 1) * limit
    
    const { data, error, count } = await supabase
      .from('resources')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      logger.error('Failed to fetch resources', error, { userId })
      throw error
    }
    
    return apiSuccess({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/resources' })
  }
}

// POST - Create resource
export async function POST(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const supabase = createClientFromRequest(req.headers.get('Authorization'))
    
    const body = await req.json()
    const validated = CreateSchema.parse(body)
    
    const { data, error } = await supabase
      .from('resources')
      .insert({
        ...validated,
        user_id: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to create resource', error, { validated, userId })
      throw error
    }
    
    logger.info('Resource created', { id: data.id, userId })
    return apiSuccess({ data }, 201)
  } catch (error) {
    return handleApiError(error, { context: 'POST /api/resources' })
  }
}

// PATCH - Update resource
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const supabase = createClientFromRequest(req.headers.get('Authorization'))
    
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) validationError('ID is required', 'id')
    
    const body = await req.json()
    const validated = UpdateSchema.parse(body)
    
    // Verify ownership
    const { data: existing } = await supabase
      .from('resources')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()
    
    if (!existing) notFoundError('Resource')
    if (existing.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    const { data, error } = await supabase
      .from('resources')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to update resource', error, { id, userId })
      throw error
    }
    
    return apiSuccess({ data })
  } catch (error) {
    return handleApiError(error, { context: 'PATCH /api/resources' })
  }
}

// DELETE - Delete resource
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const supabase = createClientFromRequest(req.headers.get('Authorization'))
    
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) validationError('ID is required', 'id')
    
    // Verify ownership
    const { data: existing } = await supabase
      .from('resources')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()
    
    if (!existing) notFoundError('Resource')
    if (existing.user_id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', id)
    
    if (error) {
      logger.error('Failed to delete resource', error, { id, userId })
      throw error
    }
    
    logger.info('Resource deleted', { id, userId })
    return apiSuccess({ success: true })
  } catch (error) {
    return handleApiError(error, { context: 'DELETE /api/resources' })
  }
}
```

### Example 2: Search Endpoint
```typescript
export async function GET(req: NextRequest) {
  try {
    const userId = await getClerkUserId()
    const adminClient = createAdminClient()
    
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const category = searchParams.get('category')
    
    let dbQuery = adminClient
      .from('listings')
      .select('id, title, price, image_url, vendor_id')
      .ilike('title', `%${query}%`)
    
    if (category) {
      dbQuery = dbQuery.eq('category', category)
    }
    
    const { data, error } = await dbQuery
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      logger.error('Search failed', error, { query, category, userId })
      throw error
    }
    
    return apiSuccess({ data: data || [] })
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/search' })
  }
}
```

---

## 🎯 Quick Decision Tree

**Which Supabase client to use?**
- Need to bypass RLS? → `createAdminClient()`
- Need user-scoped data? → `createClientFromRequest()`
- Admin route? → `createAdminClient()`
- User route? → `createClientFromRequest()`

**Which query method?**
- Expecting 0 or 1 result? → `.maybeSingle()`
- Expecting exactly 1 result? → `.single()` (with error handling)
- Expecting multiple results? → `.select()` (returns array)

**Which error helper?**
- Missing required field? → `validationError()`
- Resource not found? → `notFoundError()`
- User not authenticated? → `unauthorizedError()` (or let `getClerkUserId()` throw)
- User lacks permission? → `forbiddenError()`
- Conflict (duplicate)? → `conflictError()`
- Generic error? → `handleApiError()`

---

## 📖 Summary

This prompt provides complete guidance for backend development. Key takeaways:

1. **Always authenticate** with `getClerkUserId()`
2. **Choose the right client** (admin vs user-scoped)
3. **Validate everything** with Zod
4. **Handle errors properly** with `handleApiError()`
5. **Log important events** with `logger`
6. **Check ownership** for user operations
7. **Use TypeScript types** from Supabase
8. **Follow security best practices**

When in doubt, refer to existing routes in `app/api/` for examples!

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Status:** ✅ Complete and Ready to Use

