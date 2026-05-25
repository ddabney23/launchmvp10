# Redis Cache Integration Examples

## Quick Start

The caching layer is already configured and ready to use. Here are practical examples for integrating it into your API routes.

## Example 1: Caching Trending Posts

**File:** `app/api/posts/trending/route.ts`

```typescript
import { cacheAside, CACHE_KEYS, CACHE_TTL, invalidateSocialCaches } from '@/lib/cache'
import { createServerClient } from '@/integrations/supabase/server'

export async function GET(req: NextRequest) {
  const userId = await getClerkUserId().catch(() => null)
  
  // Cache-aside pattern: Check cache first, fetch if miss, then cache result
  const trendingPosts = await cacheAside(
    CACHE_KEYS.TRENDING_POSTS,
    async () => {
      // This only runs on cache miss
      const supabase = await createServerClient()
      const { data } = await supabase
        .from('posts')
        .select('*, author:profiles(*), likes:post_likes(count)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50)
      
      return data || []
    },
    CACHE_TTL.TRENDING_POSTS // 15 minutes
  )
  
  return successResponse({ posts: trendingPosts })
}
```

**Invalidation on Post Creation:**

```typescript
// In POST /api/posts route after creating post
import { invalidateSocialCaches } from '@/lib/cache'

const { data: newPost } = await supabase.from('posts').insert(postData)

// Invalidate trending cache so new post appears
await invalidateSocialCaches(userId, newPost.id)
```

## Example 2: User Stats Caching

**File:** `app/api/users/[id]/stats/route.ts`

```typescript
import { getUserStats, setUserStats, invalidateUserStats } from '@/lib/cache'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: userId } = params
  
  // Try cache first
  let stats = await getUserStats(userId)
  
  if (!stats) {
    // Cache miss - fetch from database
    const supabase = await createServerClient()
    
    const [posts, followers, following, profile] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
      supabase.from('profiles').select('points, level').eq('id', userId).single()
    ])
    
    stats = {
      posts_count: posts.count || 0,
      followers_count: followers.count || 0,
      following_count: following.count || 0,
      points: profile.data?.points || 0,
      level: profile.data?.level || 1
    }
    
    // Cache for next time
    await setUserStats(userId, stats)
  }
  
  return successResponse({ stats })
}
```

**Invalidation:**

```typescript
// After post creation, follow, or gamification update
import { invalidateUserStats } from '@/lib/cache'

await invalidateUserStats(userId)
```

## Example 3: Badge Definitions Caching

**File:** `app/api/admin/badges/route.ts`

```typescript
import { getAllBadges, setAllBadges, invalidateBadges } from '@/lib/cache'

export async function GET() {
  // Try cache first
  let badges = await getAllBadges()
  
  if (!badges) {
    // Cache miss
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('badges')
      .select('id, name, description, icon, tier, points_required')
      .order('name')
    
    badges = data || []
    await setAllBadges(badges)
  }
  
  return successResponse({ badges })
}

export async function POST(req: NextRequest) {
  // ... create badge logic ...
  
  // Invalidate cache after creating new badge
  await invalidateBadges()
  
  return createdResponse({ badge: newBadge })
}
```

## Example 4: Leaderboard Caching

**File:** `app/api/leaderboard/route.ts`

```typescript
import { getLeaderboard, setLeaderboard, invalidateLeaderboard } from '@/lib/cache'

export async function GET() {
  let leaderboard = await getLeaderboard()
  
  if (!leaderboard) {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, points, level')
      .order('points', { ascending: false })
      .order('level', { ascending: false })
      .limit(100)
    
    leaderboard = data || []
    await setLeaderboard(leaderboard)
  }
  
  return successResponse({ leaderboard })
}
```

**Invalidation after points update:**

```typescript
// In gamification update route
await adminClient.rpc('update_user_points', { user_id: userId, points_delta: 10 })
await invalidateLeaderboard()
```

## Example 5: Post Engagement Caching

**File:** `app/api/posts/[id]/like/route.ts`

```typescript
import { invalidatePostEngagement } from '@/lib/cache'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id
  const userId = await getClerkUserId()
  
  // Add like
  await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
  
  // Invalidate all post-related caches
  await invalidatePostEngagement(postId)
  
  return successResponse({ liked: true })
}
```

## Cache Invalidation Patterns

### Single User Update
```typescript
import { invalidateUserCaches } from '@/lib/cache'

// After profile update, vendor status change, etc.
await invalidateUserCaches(userId)
```

### Social Interaction
```typescript
import { invalidateSocialCaches } from '@/lib/cache'

// After like, comment, follow, etc.
await invalidateSocialCaches(userId, postId)
```

### Multiple Cache Clear
```typescript
import { deleteCache, CACHE_KEYS } from '@/lib/cache'

// Clear specific caches
await Promise.all([
  deleteCache(CACHE_KEYS.TRENDING_POSTS),
  deleteCache(CACHE_KEYS.LEADERBOARD),
  deleteCache(CACHE_KEYS.USER_STATS(userId))
])
```

## Monitoring Cache Health

**File:** `app/api/health/cache/route.ts`

```typescript
import { checkCacheHealth, getCacheStats } from '@/lib/cache'

export async function GET() {
  const isHealthy = await checkCacheHealth()
  const stats = await getCacheStats()
  
  return NextResponse.json({
    healthy: isHealthy,
    stats,
    uptime: isHealthy ? 'connected' : 'disconnected'
  })
}
```

## Best Practices

### 1. Cache-Aside Pattern (Recommended)
```typescript
const data = await cacheAside(
  cacheKey,
  async () => fetchFromDatabase(),
  ttl
)
```

### 2. Explicit Get/Set
```typescript
let data = await getCache(key)
if (!data) {
  data = await fetchFromDatabase()
  await setCache(key, data, ttl)
}
```

### 3. Always Invalidate on Mutations
```typescript
// After any CREATE, UPDATE, DELETE
await invalidateRelatedCaches()
```

### 4. Use Appropriate TTLs
- **Frequently changing:** 5 minutes (user stats, post engagement)
- **Moderately stable:** 15 minutes (trending posts, leaderboard)
- **Rarely changing:** 1 hour (badges, system config)

### 5. Handle Cache Failures Gracefully
```typescript
// Cache failures won't break your app - they log errors and return null
const cached = await getCache(key) // Returns null on error
if (cached) {
  return cached
}
// Always have fallback to database
return await fetchFromDatabase()
```

## Performance Testing

### Measure Cache Impact
```typescript
const start = Date.now()
const data = await cacheAside(key, fetcher, ttl)
const duration = Date.now() - start

console.log(`Cache ${data ? 'HIT' : 'MISS'} - ${duration}ms`)
```

### Expected Performance
- **Cache Hit:** 10-50ms (Redis round trip)
- **Cache Miss:** 100-500ms (database query + cache set)
- **Improvement:** 80-95% faster on cache hits

## Migration Guide

### Before (No Cache)
```typescript
export async function GET() {
  const { data } = await supabase.from('posts').select('*')
  return NextResponse.json({ posts: data })
}
```

### After (With Cache)
```typescript
import { cacheAside, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

export async function GET() {
  const posts = await cacheAside(
    CACHE_KEYS.TRENDING_POSTS,
    async () => {
      const { data } = await supabase.from('posts').select('*')
      return data || []
    },
    CACHE_TTL.TRENDING_POSTS
  )
  return NextResponse.json({ posts })
}
```

**That's it! Just 3 lines of code for caching.**
