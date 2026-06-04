import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

type RateLimitType = 'api' | 'write' | 'login' | 'ip' | 'search' | 'upload'

const redisUrl = process.env['UPSTASH_REDIS_REST_URL']
const redisToken = process.env['UPSTASH_REDIS_REST_TOKEN']

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null

// Define all rate limiters when Upstash is configured. Without Redis, proxy
// rate limiting is intentionally fail-open so builds and local dev still work.
export const rateLimiters: Partial<Record<RateLimitType, Ratelimit>> = redis
  ? {
  // General API rate limit: 60 requests per minute per user
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  
  // Strict rate limit for write operations: 10 requests per minute
  write: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:write',
  }),
  
  // Login attempts: 5 per 15 minutes
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:login',
  }),
  
  // IP-based fallback: 120 requests per minute per IP
  ip: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '1 m'),
    analytics: true,
    prefix: 'ratelimit:ip',
  }),
  
  // Search queries: 30 per minute
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:search',
  }),
  
  // File uploads: 5 per 5 minutes
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }),
}
  : {}

// Helper function with response headers
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
) {
  const limiter = rateLimiters[type]

  if (!limiter) {
    return {
      success: true,
      limit: 0,
      reset: Date.now(),
      remaining: 0,
      headers: {
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Date.now().toString(),
      },
    }
  }

  const { success, limit, reset, remaining } = await limiter.limit(identifier)
  
  return {
    success,
    limit,
    reset,
    remaining,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    },
  }
}
