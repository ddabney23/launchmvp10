import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redis = process.env['UPSTASH_REDIS_REST_URL'] && process.env['UPSTASH_REDIS_REST_TOKEN']
  ? new Redis({
      url: process.env['UPSTASH_REDIS_REST_URL'],
      token: process.env['UPSTASH_REDIS_REST_TOKEN'],
    })
  : null

// Define all rate limiters
export const rateLimiters = {
  // General API rate limit: 60 requests per minute per user
  api: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  }) : null,
  
  // Strict rate limit for write operations: 10 requests per minute
  write: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:write',
  }) : null,
  
  // Login attempts: 5 per 15 minutes
  login: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'ratelimit:login',
  }) : null,
  
  // IP-based fallback: 120 requests per minute per IP
  ip: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '1 m'),
    analytics: true,
    prefix: 'ratelimit:ip',
  }) : null,
  
  // Search queries: 30 per minute
  search: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'ratelimit:search',
  }) : null,
  
  // File uploads: 5 per 5 minutes
  upload: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'),
    analytics: true,
    prefix: 'ratelimit:upload',
  }) : null,
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
      headers: {},
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
