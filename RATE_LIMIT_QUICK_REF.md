# 🚀 Rate Limiting - Quick Reference

## ⚡ 30-Second Setup

```bash
# 1. Create Upstash database at console.upstash.com
# 2. Add to .env.local:
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# 3. Done! Rate limiting auto-enables
```

---

## 📋 Code Patterns (Copy-Paste Ready)

### Standard Route (Anonymous + Authenticated)
```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const rateLimitResponse = await rateLimit(req)
  if (rateLimitResponse) return rateLimitResponse
  
  // Your code...
}
```

### Authenticated Route
```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const userId = await getClerkUserId()
  
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse
  
  // Your code...
}
```

### Admin/Payment Route (Strict)
```typescript
import { strictRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const userId = await getClerkUserId()
  
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse
  
  // Your code...
}
```

### Webhook Route
```typescript
import { webhookRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rateLimitResponse = await webhookRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse
  
  // Your code...
}
```

---

## 📊 Rate Limits

| Type | Read | Write |
|------|------|-------|
| Anonymous | 20/min | 5/min |
| Authenticated | 100/min | 30/min |
| Admin/Payment | 10/min | 10/min |
| Webhooks | 100/min | 100/min |

---

## ✅ Routes Done

- ✅ Posts (GET, POST, PATCH, DELETE)
- ✅ Admin search
- ✅ Payment intent
- ✅ Clerk webhook

## ⏳ Routes TODO (20 min)

**Social** (5 min):
- [ ] Comments
- [ ] Likes
- [ ] Follow
- [ ] Notifications (3 routes)

**Admin** (5 min):
- [ ] Export
- [ ] User details
- [ ] Roles
- [ ] Badges (2 routes)

**Other** (10 min):
- [ ] Vendor (3 routes)
- [ ] Gamification
- [ ] Bookings (2 routes)
- [ ] Upload
- [ ] Stripe webhook
- [ ] Webhook logs

---

## 🧪 Test

```bash
# Should get 429 after 20 requests
for i in {1..25}; do curl http://localhost:3000/api/health; done
```

---

## 💰 Cost

- Free: 10,000 req/day
- ~$0-6/month for most apps
- Auto-disables without Redis (dev mode)

---

## 📚 Full Docs

- Setup: `RATE_LIMITING_SETUP.md`
- Implementation: `RATE_LIMITING_IMPLEMENTATION.md`
- Summary: `RATE_LIMITING_COMPLETE.md`
- Code: `src/lib/rate-limit.ts`
