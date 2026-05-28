import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const hasRedis =
  Boolean(redisUrl && redisToken) &&
  redisUrl!.startsWith('https://') &&
  !redisUrl!.includes('YOUR_')

const redis = hasRedis
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null

function createLimiter(
  limiter: ReturnType<typeof Ratelimit.slidingWindow>,
  prefix: string
) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter,
    analytics: true,
    prefix,
  })
}

export const rateLimiters = {
  api: createLimiter(Ratelimit.slidingWindow(60, '1 m'), 'ratelimit:api'),
  write: createLimiter(Ratelimit.slidingWindow(10, '1 m'), 'ratelimit:write'),
  login: createLimiter(Ratelimit.slidingWindow(5, '15 m'), 'ratelimit:login'),
  ip: createLimiter(Ratelimit.slidingWindow(120, '1 m'), 'ratelimit:ip'),
  search: createLimiter(Ratelimit.slidingWindow(30, '1 m'), 'ratelimit:search'),
  upload: createLimiter(Ratelimit.slidingWindow(5, '5 m'), 'ratelimit:upload'),
}

function rateLimitUnavailable() {
  return {
    success: false,
    limit: 0,
    reset: Date.now() + 60_000,
    remaining: 0,
    headers: {
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Date.now() + 60_000),
    },
  }
}

function rateLimitPassThrough() {
  return {
    success: true,
    limit: 60,
    reset: Date.now() + 60_000,
    remaining: 60,
    headers: {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': '60',
      'X-RateLimit-Reset': String(Date.now() + 60_000),
    },
  }
}

export async function checkRateLimit(
  identifier: string,
  type: keyof typeof rateLimiters = 'api'
) {
  const limiter = rateLimiters[type]

  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      return rateLimitUnavailable()
    }
    return rateLimitPassThrough()
  }

  try {
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
  } catch (error) {
    console.error('Rate limit check failed:', error)
    if (process.env.NODE_ENV === 'production') {
      return rateLimitUnavailable()
    }
    return rateLimitPassThrough()
  }
}
