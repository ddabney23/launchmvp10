/**
 * Redis Caching Layer
 * Provides caching for frequently accessed data using Upstash Redis
 * 
 * Features:
 * - Trending posts cache (15 min TTL)
 * - User stats cache (5 min TTL)
 * - Badge definitions cache (1 hour TTL)
 * - Cache invalidation on mutations
 */

import { Redis } from '@upstash/redis'
import { logger } from './logger'

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  TRENDING_POSTS: 15 * 60, // 15 minutes
  USER_STATS: 5 * 60,      // 5 minutes
  BADGES: 60 * 60,         // 1 hour
  PROFILE: 10 * 60,        // 10 minutes
  LEADERBOARD: 15 * 60,    // 15 minutes
  VENDOR_VERIFICATION: 30 * 60, // 30 minutes
} as const

// Cache key prefixes
export const CACHE_KEYS = {
  TRENDING_POSTS: 'trending:posts',
  USER_STATS: (userId: string) => `user:${userId}:stats`,
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  BADGES: 'badges:all',
  BADGE: (badgeId: string) => `badge:${badgeId}`,
  LEADERBOARD: 'leaderboard:top',
  VENDOR_STATUS: (userId: string) => `vendor:${userId}:status`,
  POST_LIKES: (postId: string) => `post:${postId}:likes`,
  POST_COMMENTS: (postId: string) => `post:${postId}:comments`,
} as const

/**
 * Generic cache get function
 * Returns null if key doesn't exist or on error
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key)
    if (value) {
      logger.debug('Cache hit', { key })
    } else {
      logger.debug('Cache miss', { key })
    }
    return value
  } catch (error) {
    logger.error('Cache get error', error, { key })
    return null // Fail silently - don't break app on cache errors
  }
}

/**
 * Generic cache set function with TTL
 */
export async function setCache<T>(
  key: string, 
  value: T, 
  ttl: number = CACHE_TTL.USER_STATS
): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value))
    logger.debug('Cache set', { key, ttl })
  } catch (error) {
    logger.error('Cache set error', error, { key, ttl })
    // Fail silently - don't break app on cache errors
  }
}

/**
 * Delete a single cache key
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key)
    logger.debug('Cache deleted', { key })
  } catch (error) {
    logger.error('Cache delete error', error, { key })
  }
}

/**
 * Delete multiple cache keys by pattern
 * Note: SCAN is more efficient than KEYS for production
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      logger.debug('Cache pattern deleted', { pattern, count: keys.length })
    }
  } catch (error) {
    logger.error('Cache pattern delete error', error, { pattern })
  }
}

// =======================
// DOMAIN-SPECIFIC CACHE FUNCTIONS
// =======================

/**
 * Get trending posts from cache
 */
export async function getTrendingPosts() {
  return getCache<any[]>(CACHE_KEYS.TRENDING_POSTS)
}

/**
 * Set trending posts cache
 */
export async function setTrendingPosts(posts: any[]) {
  return setCache(CACHE_KEYS.TRENDING_POSTS, posts, CACHE_TTL.TRENDING_POSTS)
}

/**
 * Get user stats from cache (posts count, followers, following)
 */
export async function getUserStats(userId: string) {
  return getCache<{
    posts_count: number
    followers_count: number
    following_count: number
    points: number
    level: number
  }>(CACHE_KEYS.USER_STATS(userId))
}

/**
 * Set user stats cache
 */
export async function setUserStats(userId: string, stats: any) {
  return setCache(CACHE_KEYS.USER_STATS(userId), stats, CACHE_TTL.USER_STATS)
}

/**
 * Invalidate user stats cache (call after post creation, follow, etc.)
 */
export async function invalidateUserStats(userId: string) {
  await deleteCache(CACHE_KEYS.USER_STATS(userId))
  await deleteCache(CACHE_KEYS.USER_PROFILE(userId))
}

/**
 * Get all badges from cache
 */
export async function getAllBadges() {
  return getCache<any[]>(CACHE_KEYS.BADGES)
}

/**
 * Set all badges cache
 */
export async function setAllBadges(badges: any[]) {
  return setCache(CACHE_KEYS.BADGES, badges, CACHE_TTL.BADGES)
}

/**
 * Invalidate badges cache (call after badge creation/update)
 */
export async function invalidateBadges() {
  await deleteCachePattern('badge:*')
}

/**
 * Get leaderboard from cache
 */
export async function getLeaderboard() {
  return getCache<any[]>(CACHE_KEYS.LEADERBOARD)
}

/**
 * Set leaderboard cache
 */
export async function setLeaderboard(leaderboard: any[]) {
  return setCache(CACHE_KEYS.LEADERBOARD, leaderboard, CACHE_TTL.LEADERBOARD)
}

/**
 * Invalidate leaderboard cache (call after points update)
 */
export async function invalidateLeaderboard() {
  await deleteCache(CACHE_KEYS.LEADERBOARD)
}

/**
 * Get vendor verification status from cache
 */
export async function getVendorStatus(userId: string) {
  return getCache<{
    isVendor: boolean
    isVerified: boolean
    applicationStatus?: string
  }>(CACHE_KEYS.VENDOR_STATUS(userId))
}

/**
 * Set vendor verification status cache
 */
export async function setVendorStatus(userId: string, status: any) {
  return setCache(CACHE_KEYS.VENDOR_STATUS(userId), status, CACHE_TTL.VENDOR_VERIFICATION)
}

/**
 * Invalidate vendor status cache (call after verification approval/rejection)
 */
export async function invalidateVendorStatus(userId: string) {
  await deleteCache(CACHE_KEYS.VENDOR_STATUS(userId))
}

/**
 * Get post likes count from cache
 */
export async function getPostLikes(postId: string) {
  return getCache<number>(CACHE_KEYS.POST_LIKES(postId))
}

/**
 * Set post likes count cache
 */
export async function setPostLikes(postId: string, count: number) {
  return setCache(CACHE_KEYS.POST_LIKES(postId), count, CACHE_TTL.USER_STATS)
}

/**
 * Invalidate post engagement cache (call after like/comment)
 */
export async function invalidatePostEngagement(postId: string) {
  await deleteCache(CACHE_KEYS.POST_LIKES(postId))
  await deleteCache(CACHE_KEYS.POST_COMMENTS(postId))
  await deleteCache(CACHE_KEYS.TRENDING_POSTS) // Trending may change
}

/**
 * Cache-aside pattern wrapper
 * Tries cache first, then fetches from DB if miss, then caches result
 * 
 * Example usage:
 * ```ts
 * const badges = await cacheAside(
 *   CACHE_KEYS.BADGES,
 *   async () => {
 *     const { data } = await supabase.from('badges').select('*')
 *     return data || []
 *   },
 *   CACHE_TTL.BADGES
 * )
 * ```
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try cache first
  const cached = await getCache<T>(key)
  if (cached !== null) {
    return cached
  }

  // Cache miss - fetch from source
  const fresh = await fetcher()
  
  // Cache the result (don't await - fire and forget)
  setCache(key, fresh, ttl).catch(err => 
    logger.error('Cache-aside set error', err, { key })
  )

  return fresh
}

/**
 * Batch invalidate user-related caches
 * Call this when user data changes significantly (profile update, etc.)
 */
export async function invalidateUserCaches(userId: string) {
  await Promise.all([
    deleteCache(CACHE_KEYS.USER_STATS(userId)),
    deleteCache(CACHE_KEYS.USER_PROFILE(userId)),
    deleteCache(CACHE_KEYS.VENDOR_STATUS(userId)),
  ])
}

/**
 * Batch invalidate social engagement caches
 * Call this when social interactions occur (likes, comments, follows)
 */
export async function invalidateSocialCaches(userId: string, postId?: string) {
  const promises = [
    deleteCache(CACHE_KEYS.USER_STATS(userId)),
    deleteCache(CACHE_KEYS.TRENDING_POSTS),
    deleteCache(CACHE_KEYS.LEADERBOARD),
  ]
  
  if (postId) {
    promises.push(
      deleteCache(CACHE_KEYS.POST_LIKES(postId)),
      deleteCache(CACHE_KEYS.POST_COMMENTS(postId))
    )
  }
  
  await Promise.all(promises)
}

/**
 * Health check for Redis connection
 */
export async function checkCacheHealth(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch (error) {
    logger.error('Redis health check failed', error)
    return false
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getCacheStats() {
  try {
    const info = await redis.info()
    return {
      connected: true,
      info,
    }
  } catch (error) {
    logger.error('Failed to get cache stats', error)
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
