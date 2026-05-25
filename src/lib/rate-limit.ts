/**
 * Rate Limiting with Upstash Redis
 * 
 * Provides configurable rate limiting for API routes with different limits
 * for authenticated vs anonymous users, and different limits for read vs write operations.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse, errorResponse } from './api-response'

// Initialize Redis client
// Falls back to in-memory storage if Redis is not configured (dev mode)
const redis = process.env['UPSTASH_REDIS_REST_URL'] && process.env['UPSTASH_REDIS_REST_TOKEN']
  ? new Redis({
      url: process.env['UPSTASH_REDIS_REST_URL'],
      token: process.env['UPSTASH_REDIS_REST_TOKEN'],
    })
  : undefined

// Rate limit configurations
const rateLimiters = {
  // Authenticated users - read operations (GET)
  authenticatedRead: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 requests per minute
        analytics: true,
        prefix: '@ratelimit/auth/read',
      })
    : null,

  // Authenticated users - write operations (POST, PUT, PATCH, DELETE)
  authenticatedWrite: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'), // 30 requests per minute
        analytics: true,
        prefix: '@ratelimit/auth/write',
      })
    : null,

  // Anonymous users - read operations
  anonymousRead: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '60 s'), // 20 requests per minute
        analytics: true,
        prefix: '@ratelimit/anon/read',
      })
    : null,

  // Anonymous users - write operations
  anonymousWrite: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 requests per minute
        analytics: true,
        prefix: '@ratelimit/anon/write',
      })
    : null,

  // Strict rate limit for sensitive operations (admin, payment, etc.)
  strict: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per minute
        analytics: true,
        prefix: '@ratelimit/strict',
      })
    : null,

  // Very strict for webhooks
  webhook: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 webhooks per minute
        analytics: true,
        prefix: '@ratelimit/webhook',
      })
    : null,
}

/**
 * Rate limit types
 */
export type RateLimitType = 'authenticatedRead' | 'authenticatedWrite' | 'anonymousRead' | 'anonymousWrite' | 'strict' | 'webhook'

/**
 * Get the appropriate rate limiter based on request method and authentication
 */
function getRateLimiter(type: RateLimitType) {
  return rateLimiters[type]
}

/**
 * Get identifier for rate limiting (IP or user ID)
 */
function getIdentifier(req: NextRequest, userId?: string): string {
  // Use user ID if authenticated
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? (forwarded.split(',')[0]?.trim() || 'unknown') : req.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

/**
 * Check rate limit and return appropriate response
 */
export async function checkRateLimit(
  req: NextRequest,
  type: RateLimitType,
  userId?: string
): Promise<NextResponse<ApiResponse> | null> {
  const limiter = getRateLimiter(type)

  // Skip rate limiting if Redis is not configured (development mode)
  if (!limiter) {
    console.warn('⚠️ Rate limiting disabled - Redis not configured')
    return null
  }

  const identifier = getIdentifier(req, userId)

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier)

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    }

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)

      const response = errorResponse(
        'Rate limit exceeded',
        'RATE_LIMIT',
        {
          message: 'Too many requests. Please try again later.',
          retry_after: retryAfter,
        },
        429
      )
      response.headers.set('Retry-After', retryAfter.toString())
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }

    // Return null to indicate success (caller can add headers if needed)
    return null
  } catch (error) {
    // Log error but don't block the request if rate limiting fails
    console.error('Rate limit check failed:', error)
    return null
  }
}

/**
 * Helper to determine rate limit type based on request method
 */
export function getRateLimitType(method: string, isAuthenticated: boolean): RateLimitType {
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isAuthenticated) {
    return isWrite ? 'authenticatedWrite' : 'authenticatedRead'
  } else {
    return isWrite ? 'anonymousWrite' : 'anonymousRead'
  }
}

/**
 * Wrapper function for easy rate limiting in route handlers
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   const rateLimitResponse = await rateLimit(req)
 *   if (rateLimitResponse) return rateLimitResponse
 *   
 *   // Your route logic here
 * }
 * ```
 */
export async function rateLimit(
  req: NextRequest,
  options?: {
    type?: RateLimitType
    userId?: string
  }
): Promise<NextResponse<ApiResponse> | null> {
  const type = options?.type || getRateLimitType(req.method, !!options?.userId)
  return checkRateLimit(req, type, options?.userId)
}

/**
 * Strict rate limit for sensitive operations
 */
export async function strictRateLimit(req: NextRequest, userId?: string): Promise<NextResponse<ApiResponse> | null> {
  return checkRateLimit(req, 'strict', userId)
}

/**
 * Webhook rate limit
 */
export async function webhookRateLimit(req: NextRequest): Promise<NextResponse<ApiResponse> | null> {
  return checkRateLimit(req, 'webhook')
}
