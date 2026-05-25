# Rate Limiting Setup Guide

## Overview
This application uses **Upstash Redis** for distributed rate limiting to protect API routes from abuse.

## Rate Limit Tiers

### Authenticated Users
- **Read Operations** (GET): 100 requests/minute
- **Write Operations** (POST/PUT/PATCH/DELETE): 30 requests/minute

### Anonymous Users
- **Read Operations** (GET): 20 requests/minute
- **Write Operations**: 5 requests/minute

### Special Limits
- **Strict** (Admin, Payment): 10 requests/minute
- **Webhooks**: 100 requests/minute

## Setup Instructions

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up or log in
3. Click **Create Database**
4. Choose:
   - **Type**: Regional (lower latency) or Global (higher availability)
   - **Region**: Choose closest to your app deployment
   - **Name**: `my-app-ratelimit` (or your preferred name)
5. Click **Create**

### 2. Get Your Credentials

After creating the database:
1. Go to the **Details** tab
2. Scroll to **REST API** section
3. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Add to Environment Variables

Add these to your `.env.local` file:

```bash
# Upstash Redis for Rate Limiting
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### 4. Verify Setup

The rate limiting system will automatically:
- ✅ Enable when Redis credentials are present
- ⚠️ Disable (with warning) in development if credentials missing
- 🔒 Block requests when limits exceeded (429 status)

## Development Mode

**Without Redis credentials**:
- Rate limiting is disabled
- Console warning: "⚠️ Rate limiting disabled - Redis not configured"
- All requests pass through

**With Redis credentials**:
- Rate limiting is active
- Requests are tracked by user ID or IP address
- Limits enforced according to tier

## Testing Rate Limits

```bash
# Test anonymous limit (20 requests/min for GET)
for i in {1..25}; do curl http://localhost:3000/api/health; done

# You should see 429 errors after 20 requests
```

## Response Headers

When rate limiting is active, all responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1700000000000
```

When limit exceeded (429 response):

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 45
}
```

Headers include:
```
Retry-After: 45
```

## Usage in API Routes

### Automatic Rate Limiting

```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Auto-detects: anonymous read limit (20/min)
  const rateLimitResponse = await rateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  // Your route logic
}
```

### Authenticated Rate Limiting

```typescript
import { rateLimit } from '@/lib/rate-limit'
import { getClerkUserId } from '@/integrations/clerk/server'

export async function POST(req: NextRequest) {
  const userId = await getClerkUserId()
  
  // Uses authenticated write limit (30/min)
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  // Your route logic
}
```

### Strict Rate Limiting

For sensitive operations (admin, payment):

```typescript
import { strictRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const userId = await getClerkUserId()
  
  // Uses strict limit (10/min)
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  // Sensitive operation
}
```

### Webhook Rate Limiting

```typescript
import { webhookRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Uses webhook limit (100/min)
  const rateLimitResponse = await webhookRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  // Process webhook
}
```

## Monitoring

### Upstash Console
1. Go to your database in Upstash Console
2. Click **Metrics** tab
3. View:
   - Request count
   - Response times
   - Error rates
   - Peak usage times

### Application Logs
Rate limit hits are logged:
```
⚠️ Rate limit exceeded for ip:192.168.1.1
⚠️ Rate limit exceeded for user:user_123abc
```

## Adjusting Limits

Edit `src/lib/rate-limit.ts`:

```typescript
authenticatedRead: new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'), // Change 100 to your limit
  analytics: true,
})
```

Available window formats:
- `'60 s'` - 60 seconds
- `'1 m'` - 1 minute
- `'1 h'` - 1 hour
- `'1 d'` - 1 day

## Cost Estimation

**Upstash Free Tier**:
- 10,000 requests/day
- Sufficient for development and small apps

**Example Usage**:
- 1000 users × 10 requests/day = 10,000 requests
- Stays within free tier

**Paid Tiers**:
- Pay-as-you-go: $0.20 per 100K requests
- Pro: $40/month (1M requests included)

## Production Checklist

- [ ] Created Upstash Redis database
- [ ] Added credentials to production environment
- [ ] Tested rate limits work correctly
- [ ] Configured appropriate limits for your use case
- [ ] Set up monitoring/alerts
- [ ] Documented limits in API documentation
- [ ] Tested 429 error handling in frontend

## Troubleshooting

### Rate limiting not working
1. Check environment variables are set
2. Verify Redis URL and token are correct
3. Check console for warnings
4. Test with: `curl -v http://localhost:3000/api/health`

### Too many 429 errors
1. Review limits in `src/lib/rate-limit.ts`
2. Check if legitimate traffic patterns
3. Consider increasing limits for authenticated users
4. Monitor Upstash metrics for patterns

### Redis connection errors
1. Verify Upstash database is active
2. Check network connectivity
3. Verify credentials are not expired
4. Check Upstash status page

## Alternative: In-Memory Rate Limiting

For development without Redis:

```typescript
import { Ratelimit } from '@upstash/ratelimit'

// Use in-memory store (not recommended for production)
const cache = new Map()

const limiter = new Ratelimit({
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  ephemeralCache: cache,
})
```

⚠️ **Warning**: In-memory rate limiting only works on a single server instance and resets on restart. Use Redis for production.

## Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Ratelimit SDK](https://github.com/upstash/ratelimit)
- [Next.js Middleware Rate Limiting](https://nextjs.org/docs/app/building-your-application/routing/middleware)
