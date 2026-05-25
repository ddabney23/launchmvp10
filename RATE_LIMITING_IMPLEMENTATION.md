# Rate Limiting Quick Implementation Guide

## ✅ What's Been Done

### Files Created
1. **`src/lib/rate-limit.ts`** - Complete rate limiting system
2. **`RATE_LIMITING_SETUP.md`** - Full documentation

### Routes Updated (Examples)
- ✅ `app/api/posts/route.ts` - GET (read) and POST (write) with rate limiting
- ✅ `app/api/posts/[id]/route.ts` - GET, PATCH, DELETE with rate limiting
- ✅ `app/api/admin/users/search/route.ts` - Strict rate limiting (10/min)
- ✅ `app/api/payment/create-intent/route.ts` - Strict rate limiting
- ✅ `app/api/webhooks/clerk/route.ts` - Webhook rate limiting (100/min)

### Environment Variables
- ✅ Added to `env.example.txt`:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

---

## 🚀 Next Steps to Complete (30 minutes)

### Step 1: Set Up Upstash Redis (5 minutes)

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up or log in
3. Click **Create Database**
4. Settings:
   - Name: `optimix-ratelimit`
   - Region: Choose nearest to your deployment
   - Type: Regional (recommended)
5. Click **Create**
6. Go to **REST API** tab
7. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### Step 2: Add to Environment (2 minutes)

Add to your `.env.local`:

```bash
# Upstash Redis for Rate Limiting
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Step 3: Apply to Remaining Routes (20 minutes)

Apply rate limiting to the remaining API routes. Here's the pattern:

#### For Anonymous/Public Routes
```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Rate limit: anonymous 20/min, authenticated 100/min
  const rateLimitResponse = await rateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  // Your route logic...
}
```

#### For Authenticated Routes
```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const userId = await getClerkUserId()
  
  // Rate limit: authenticated write 30/min
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  // Your route logic...
}
```

#### For Admin/Sensitive Routes
```typescript
import { strictRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const userId = await getClerkUserId()
  
  // Strict limit: 10/min
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  // Your route logic...
}
```

#### For Webhooks
```typescript
import { webhookRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Webhook limit: 100/min
  const rateLimitResponse = await webhookRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  // Your route logic...
}
```

### Step 4: Apply to These Remaining Routes

#### Comments Routes
- [ ] `app/api/posts/[id]/comments/route.ts` (GET, POST)

#### Likes Routes
- [ ] `app/api/posts/[id]/like/route.ts` (POST, DELETE)

#### Follow Routes
- [ ] `app/api/users/[id]/follow/route.ts` (GET, POST, DELETE)

#### Notifications Routes
- [ ] `app/api/notifications/route.ts` (GET)
- [ ] `app/api/notifications/[id]/read/route.ts` (PATCH)
- [ ] `app/api/notifications/read-all/route.ts` (PATCH)

#### Admin Routes (use `strictRateLimit`)
- [ ] `app/api/admin/users/export/route.ts`
- [ ] `app/api/admin/users/[id]/route.ts`
- [ ] `app/api/admin/users/[id]/roles/route.ts`
- [ ] `app/api/admin/users/[id]/badges/route.ts`
- [ ] `app/api/admin/badges/route.ts`

#### Vendor Routes
- [ ] `app/api/vendor/applications/route.ts` (GET, POST)
- [ ] `app/api/vendor/applications/[id]/route.ts` (GET)
- [ ] `app/api/vendor/verify/route.ts` (POST - use `strictRateLimit`)

#### Gamification Routes
- [ ] `app/api/gamification/update/route.ts` (POST)

#### Booking Routes
- [ ] `app/api/bookings/route.ts` (POST)
- [ ] `app/api/bookings/[id]/route.ts` (PATCH)

#### Upload Routes
- [ ] `app/api/upload/route.ts` (POST)

#### Webhook Routes
- [ ] `app/api/webhooks/stripe/route.ts` (use `webhookRateLimit`)
- [ ] `app/api/webhooks/logs/route.ts` (GET)

### Step 5: Test Rate Limiting (3 minutes)

1. Start dev server: `npm run dev`

2. Test anonymous limit:
```bash
# Should succeed for first 20, then return 429
for i in {1..25}; do curl http://localhost:3000/api/health; echo; done
```

3. Check response headers:
```bash
curl -v http://localhost:3000/api/health
# Look for: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

4. Verify 429 response:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 45
}
```

---

## 📊 Current Rate Limit Tiers

| User Type | Operation | Limit | Window |
|-----------|-----------|-------|--------|
| Anonymous | Read (GET) | 20 | 1 minute |
| Anonymous | Write | 5 | 1 minute |
| Authenticated | Read (GET) | 100 | 1 minute |
| Authenticated | Write | 30 | 1 minute |
| Admin/Payment | All | 10 | 1 minute |
| Webhooks | All | 100 | 1 minute |

---

## 🎯 Priority Routes (Do These First)

1. **HIGH PRIORITY** (Prevent abuse):
   - ✅ Posts API (done)
   - ✅ Admin routes (done)
   - ✅ Payment routes (done)
   - ✅ Webhooks (done)
   - [ ] Upload route
   - [ ] Vendor verification

2. **MEDIUM PRIORITY** (Social features):
   - [ ] Comments API
   - [ ] Likes API
   - [ ] Follow API
   - [ ] Notifications API

3. **LOW PRIORITY** (Less critical):
   - [ ] Health check (optional - it's public)
   - [ ] Webhook logs (admin only)

---

## 🔧 Development vs Production

### Development (without Redis)
- Rate limiting **disabled** automatically
- Console warning: "⚠️ Rate limiting disabled - Redis not configured"
- All requests pass through
- No additional setup needed

### Production (with Redis)
- Rate limiting **active** automatically when env vars present
- Requests tracked by user ID or IP
- 429 responses when limits exceeded
- Monitoring via Upstash dashboard

---

## 💰 Cost Estimate

**Upstash Free Tier**:
- 10,000 requests/day
- Perfect for development and small apps

**Example Usage**:
- 1,000 users × 10 requests/day = 10,000 requests
- Stays within free tier

**Paid (if needed)**:
- Pay-as-you-go: $0.20 per 100K requests
- Example: 1M requests/month = ~$2/month

---

## ✅ Verification Checklist

After implementation, verify:

- [ ] Redis credentials added to `.env.local`
- [ ] Rate limiting applied to all API routes
- [ ] Test suite still passes: `npm run test:api`
- [ ] 429 responses include proper headers
- [ ] Anonymous vs authenticated limits work correctly
- [ ] Strict limits work on admin/payment routes
- [ ] Upstash dashboard shows metrics
- [ ] No rate limit warnings in development (expected)

---

## 📚 References

- **Full Documentation**: `RATE_LIMITING_SETUP.md`
- **Implementation**: `src/lib/rate-limit.ts`
- **Upstash Docs**: https://docs.upstash.com/redis
- **Rate Limit SDK**: https://github.com/upstash/ratelimit

---

## 🚨 Important Notes

1. **Don't commit credentials**: Keep `.env.local` in `.gitignore`
2. **Different limits for production**: Adjust in `src/lib/rate-limit.ts` based on real usage
3. **Monitor Upstash usage**: Set up alerts if approaching limits
4. **Test before deploying**: Ensure 429 responses don't break frontend
5. **Document limits**: Update API docs with rate limit information

---

## Next High Priority Task

After completing rate limiting, move to:
- **Apply validation to remaining routes** (MEDIUM priority)
- Pattern already established in Posts API
- Copy validation approach from `app/api/posts/route.ts`

See `CONVERSATION_SUMMARY.md` for full task breakdown.
