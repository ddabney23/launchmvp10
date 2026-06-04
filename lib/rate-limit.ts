import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis =
  process.env['UPSTASH_REDIS_REST_URL'] && process.env['UPSTASH_REDIS_REST_TOKEN']
    ? new Redis({
        url: process.env['UPSTASH_REDIS_REST_URL'],
        token: process.env['UPSTASH_REDIS_REST_TOKEN'],
      })
    : null

function createRateLimiter(
  requests: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
  prefix: string
) {
  if (!redis) {
    return null
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix,
  })
}

// Define all rate limiters
export const rateLimiters = {
  // General API rate limit: 60 requests per minute per user
  api: createRateLimiter(60, '1 m', 'ratelimit:api'),
  
  // Strict rate limit for write operations: 10 requests per minute
  write: createRateLimiter(10, '1 m', 'ratelimit:write'),
  
  // Login attempts: 5 per 15 minutes
  login: createRateLimiter(5, '15 m', 'ratelimit:login'),
  
  // IP-based fallback: 120 requests per minute per IP
  ip: createRateLimiter(120, '1 m', 'ratelimit:ip'),
  
  // Search queries: 30 per minute
  search: createRateLimiter(30, '1 m', 'ratelimit:search'),
  
  // File uploads: 5 per 5 minutes
  upload: createRateLimiter(5, '5 m', 'ratelimit:upload'),
}

// Helper function with response headers
export async function checkRateLimit(
  identifier: string,
  type: keyof typeof rateLimiters = 'api'
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
