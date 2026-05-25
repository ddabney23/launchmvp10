// CLERK MIGRATION: Trending posts algorithm and analytics
import { supabase } from '@/integrations/supabase/client'
import type { Post } from './types'
import { getCache, setCache } from './cache'
import { logger } from './logger'

export interface TrendingPost extends Post {
  trending_score: number
  engagement_score: number
}

/**
 * Calculate trending score for a post
 * Formula: score = (likes * 2) + (comments * 3) + (shares * 5) - (age_in_hours * 0.5)
 */
export function calculateTrendingScore(
  likes: number,
  comments: number,
  shares: number,
  createdAt: string
): number {
  const now = new Date()
  const created = new Date(createdAt)
  const ageInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)

  const engagementScore = likes * 2 + comments * 3 + shares * 5
  const agePenalty = ageInHours * 0.5

  return Math.max(0, engagementScore - agePenalty)
}

/**
 * Get trending posts
 * @param limit Number of posts to return
 * @param timeWindow Hours to look back (default: 24)
 */
export async function getTrendingPosts(
  limit: number = 20,
  timeWindow: number = 24
): Promise<TrendingPost[]> {
  const timeWindowAgo = new Date()
  timeWindowAgo.setHours(timeWindowAgo.getHours() - timeWindow)

  // Get posts from the time window
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .gte('created_at', timeWindowAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit * 3) // Get more to calculate scores

  if (error || !posts) {
    logger.error('Error fetching posts for trending:', error)
    return []
  }

  // Calculate scores for each post
  const postsWithScores = await Promise.all(
    posts.map(async (post) => {
      // Get engagement metrics
      const [likesResult, commentsResult, sharesResult] = await Promise.all([
        supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('target_type', 'post')
          .eq('target_id', post.id),
        supabase
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id),
        supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('shared_post_id', post.id),
      ])

      const likes = likesResult.count || 0
      const comments = commentsResult.count || 0
      const shares = sharesResult.count || 0

      const trendingScore = calculateTrendingScore(
        likes,
        comments,
        shares,
        post.created_at
      )

      return {
        ...post,
        trending_score: trendingScore,
        engagement_score: likes * 2 + comments * 3 + shares * 5,
      } as TrendingPost
    })
  )

  // Sort by trending score and return top N
  return postsWithScores
    .sort((a, b) => b.trending_score - a.trending_score)
    .slice(0, limit)
}

/**
 * Get trending vendors (highest sales/engagement in last 7 days)
 */
export async function getTrendingVendors(limit: number = 10) {
  const cacheKey = `trending:vendors:${limit}`;
  
  // Try to get from cache
  const cached = await getCache(cacheKey);
  if (cached) {
    logger.debug('Returning cached trending vendors');
    return cached;
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Get vendors with highest order count and revenue
  const { data: vendors, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      avatar_url,
      is_vendor,
      vendor_verified
    `)
    .eq('is_vendor', true)
    .eq('vendor_verified', true)
    .limit(limit * 2)

  if (error || !vendors) {
    logger.error('Error fetching trending vendors:', error)
    return []
  }

  // Calculate vendor scores
  const vendorsWithScores = await Promise.all(
    vendors.map(async (vendor) => {
      // Get order count and revenue
      const { data: orders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('vendor', vendor.id)
        .gte('created_at', sevenDaysAgo.toISOString())

      const orderCount = orders?.length || 0
      const revenue =
        orders?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0

      // Get engagement (followers, post likes)
      const { data: followers } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', vendor.id)

      const followerCount = followers?.count || 0

      // Calculate score: revenue * 0.5 + orders * 10 + followers * 2
      const score = revenue * 0.5 + orderCount * 10 + followerCount * 2

      return {
        ...vendor,
        trending_score: score,
        order_count: orderCount,
        revenue,
        follower_count: followerCount,
      }
    })
  )

  const result = vendorsWithScores
    .sort((a, b) => b.trending_score - a.trending_score)
    .slice(0, limit)

  // Cache for 15 minutes
  await setCache(cacheKey, result, 900);

  return result;
}

/**
 * Cache trending posts in Redis with 10-minute TTL
 */
export async function getCachedTrendingPosts(limit: number = 20): Promise<TrendingPost[]> {
  const cacheKey = `trending:posts:${limit}`;
  
  // Try to get from cache
  const cached = await getCache(cacheKey);
  if (cached) {
    logger.debug('Returning cached trending posts');
    return cached as TrendingPost[];
  }

  // Fetch fresh data
  const trendingPosts = await getTrendingPosts(limit);

  // Cache for 10 minutes (600 seconds)
  await setCache(cacheKey, trendingPosts, 600);

  return trendingPosts;
}

/**
 * Get personalized trending posts based on user interests
 */
export async function getPersonalizedTrendingPosts(
  userId: string,
  limit: number = 20
): Promise<TrendingPost[]> {
  const cacheKey = `trending:personalized:${userId}:${limit}`;

  // Try to get from cache
  const cached = await getCache(cacheKey);
  if (cached) {
    logger.debug('Returning cached personalized trending posts');
    return cached as TrendingPost[];
  }

  // Get user's followed vendors and interests
  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  const followedUserIds = follows?.map((f) => f.following_id) || []

  // Get trending posts, but boost posts from followed users
  const allTrending = await getTrendingPosts(limit * 2)

  // Boost score for posts from followed users
  const personalized = allTrending.map((post) => {
    if (followedUserIds.includes(post.user_id)) {
      return {
        ...post,
        trending_score: post.trending_score * 1.5, // 50% boost
      }
    }
    return post
  })

  const result = personalized
    .sort((a, b) => b.trending_score - a.trending_score)
    .slice(0, limit)

  // Cache for 5 minutes (300 seconds) - shorter TTL for personalized
  await setCache(cacheKey, result, 300);

  return result;
}
