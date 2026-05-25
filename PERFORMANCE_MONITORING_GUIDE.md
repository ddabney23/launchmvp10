# Performance Monitoring Guide

## Overview

This guide covers how to monitor the performance improvements from indexes, caching, and query optimizations.

## 1. Database Performance Monitoring

### Check Index Usage

Run this query in Supabase SQL Editor to verify indexes are being used:

```sql
-- List all indexes and their sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY times_used DESC, index_size DESC;
```

### Verify Index Effectiveness

Check if queries are using indexes:

```sql
-- Explain query plan for posts feed
EXPLAIN ANALYZE
SELECT * FROM posts 
WHERE user_id = 'some-uuid' 
  AND is_deleted = false 
ORDER BY created_at DESC 
LIMIT 20;

-- Look for "Index Scan using idx_posts_user_created"
-- Should show actual time < 50ms for indexed queries
```

### Monitor Slow Queries

Enable slow query logging in Supabase:

```sql
-- Find slowest queries (requires pg_stat_statements extension)
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## 2. Cache Performance Monitoring

### Cache Hit Rate Tracking

Add to your API routes to track cache performance:

```typescript
import { logger } from '@/lib/logger'

const start = Date.now()
let cacheHit = false

const data = await getCache<PostType[]>(CACHE_KEYS.TRENDING_POSTS)
if (data) {
  cacheHit = true
} else {
  // Fetch from database
  data = await fetchFromDatabase()
  await setCache(CACHE_KEYS.TRENDING_POSTS, data, CACHE_TTL.TRENDING_POSTS)
}

const duration = Date.now() - start
logger.info('Cache performance', {
  key: CACHE_KEYS.TRENDING_POSTS,
  hit: cacheHit,
  duration_ms: duration
})
```

### Upstash Redis Dashboard

Monitor cache metrics in Upstash Console:
- https://console.upstash.com/

**Key Metrics:**
- **Hit Rate:** Should be 70-90% after warm-up
- **Commands/sec:** Track request volume
- **Latency:** Should be < 50ms
- **Memory Usage:** Monitor cache size
- **Eviction Count:** Should be low (indicates cache thrashing if high)

### Cache Health Endpoint

Use the cache health API to monitor:

```bash
curl https://your-domain.com/api/health/cache
```

Expected response:
```json
{
  "status": "healthy",
  "connected": true,
  "timestamp": "2025-11-20T12:00:00Z",
  "stats": {
    "connected": true,
    "info": "..."
  }
}
```

## 3. API Response Time Monitoring

### Add Performance Logging

Create a middleware or utility:

```typescript
// src/lib/performance.ts
export class PerformanceMonitor {
  private start: number
  
  constructor(private route: string) {
    this.start = Date.now()
  }
  
  log(operation: string, metadata?: Record<string, any>) {
    const duration = Date.now() - this.start
    logger.info('Performance', {
      route: this.route,
      operation,
      duration_ms: duration,
      ...metadata
    })
  }
}

// Usage in API route:
export async function GET(req: NextRequest) {
  const perf = new PerformanceMonitor('/api/posts')
  
  const posts = await fetchPosts()
  perf.log('fetch_posts', { count: posts.length })
  
  return successResponse({ posts })
}
```

### Track Key Metrics

Monitor these endpoints for performance:

**High Traffic Routes:**
- `/api/posts` - Posts feed (target: < 200ms with cache)
- `/api/notifications` - Notifications (target: < 150ms with cursor pagination)
- `/api/users/[id]` - User profile (target: < 100ms with cache)

**Database-Heavy Routes:**
- `/api/leaderboard` - Leaderboard (target: < 500ms with cache, < 100ms on hit)
- `/api/posts/trending` - Trending (target: < 300ms with cache)

## 4. Expected Performance Improvements

### Before Optimizations

| Route | Avg Response Time | Notes |
|-------|-------------------|-------|
| Posts Feed | 300-800ms | Full table scan |
| Notifications | 500-1500ms | Offset pagination on large dataset |
| User Stats | 200-500ms | Multiple COUNT queries |
| Leaderboard | 800-2000ms | ORDER BY on large table |
| Trending Posts | 600-1500ms | Complex aggregation |

### After Optimizations

| Route | Avg Response Time | Improvement | Method |
|-------|-------------------|-------------|--------|
| Posts Feed | 50-150ms | **75-85%** | Index on (user_id, created_at) |
| Notifications | 80-200ms | **80-90%** | Cursor pagination + index |
| User Stats | 20-50ms | **90-95%** | Redis cache (5min TTL) |
| Leaderboard | 30-100ms | **90-95%** | Redis cache (15min TTL) |
| Trending Posts | 50-150ms | **85-90%** | Redis cache (15min TTL) |

## 5. Database Index Monitoring

### Check Index Health

```sql
-- Check for unused indexes (consider removing)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check for duplicate indexes
SELECT
    array_agg(indexname) AS indexes,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename, indexdef
HAVING count(*) > 1;
```

### Monitor Index Bloat

```sql
-- Check index bloat (should be < 30%)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    ROUND(100 * (pg_relation_size(indexrelid) / NULLIF(pg_relation_size(tableid), 0)::numeric), 2) AS index_ratio
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## 6. Query Optimization Verification

### Test Cursor Pagination Performance

```typescript
// Test offset pagination (slow)
const start1 = Date.now()
const { data: offset } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .range(1000, 1020) // Skipping 1000 records
const offsetTime = Date.now() - start1

// Test cursor pagination (fast)
const start2 = Date.now()
const { data: cursor } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .lt('created_at', lastSeenTimestamp)
  .limit(20)
const cursorTime = Date.now() - start2

console.log(`Offset: ${offsetTime}ms vs Cursor: ${cursorTime}ms`)
// Expected: Cursor is 60-80% faster for large offsets
```

### Monitor Data Transfer

```typescript
// Before: SELECT *
const { data: fullData } = await supabase
  .from('posts')
  .select('*') // Fetches all columns
  
// After: Specific fields
const { data: optimized } = await supabase
  .from('posts')
  .select('id, content, created_at, user_id')
  
console.log('Full size:', JSON.stringify(fullData).length)
console.log('Optimized size:', JSON.stringify(optimized).length)
// Expected: 30-50% reduction in data transfer
```

## 7. Production Monitoring Setup

### Vercel Analytics (if using Vercel)

Enable in `vercel.json`:
```json
{
  "analytics": {
    "enabled": true
  }
}
```

Monitor:
- P50, P75, P95, P99 response times
- Error rates per route
- Cache hit rates

### Supabase Metrics

Check in Supabase Dashboard:
- **Database > Query Performance**
  - Identify slow queries (> 1000ms)
  - Check query frequency
  - Monitor connection pool usage

- **Database > Reports**
  - Active connections
  - Slow queries
  - Index usage statistics

### Custom Metrics Endpoint

Create `/api/metrics` for monitoring:

```typescript
import { checkCacheHealth } from '@/lib/cache'
import { createServerClient } from '@/integrations/supabase/server'

export async function GET() {
  const cacheHealthy = await checkCacheHealth()
  
  // Test database query speed
  const dbStart = Date.now()
  const supabase = await createServerClient()
  await supabase.from('profiles').select('id').limit(1)
  const dbDuration = Date.now() - dbStart
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    cache: {
      healthy: cacheHealthy,
      status: cacheHealthy ? 'up' : 'down'
    },
    database: {
      healthy: dbDuration < 100,
      latency_ms: dbDuration
    }
  })
}
```

## 8. Performance Testing Checklist

### Post-Deployment Tests

- [ ] Run `EXPLAIN ANALYZE` on critical queries
- [ ] Verify indexes created: `\di` in Supabase SQL editor
- [ ] Check cache health: `GET /api/health/cache`
- [ ] Test trending posts endpoint 3x (1st miss, 2nd+ hit)
- [ ] Monitor Upstash Redis dashboard for 24 hours
- [ ] Check Supabase slow query log
- [ ] Verify cursor pagination works: `GET /api/notifications?cursor=...`
- [ ] Load test high-traffic endpoints (optional)

### Performance Regression Detection

Set up alerts for:
- API response time > 1000ms (95th percentile)
- Cache hit rate < 60%
- Database query time > 500ms (avg)
- Redis connection failures

## 9. Troubleshooting

### High Cache Miss Rate

**Symptoms:** Cache hit rate < 50%

**Causes:**
- TTL too short (data expires before reuse)
- Cache keys changing (ensure consistent key generation)
- Low traffic (cache not warming up)

**Solutions:**
- Increase TTL for stable data
- Pre-warm cache on deployment
- Review cache key generation logic

### Slow Queries Despite Indexes

**Symptoms:** Queries still slow (> 500ms)

**Diagnosis:**
```sql
EXPLAIN ANALYZE SELECT ...
-- Look for "Seq Scan" instead of "Index Scan"
```

**Causes:**
- Query not using index (column mismatch)
- Index selectivity too low (< 5% of rows)
- Missing composite index

**Solutions:**
- Verify column names match index
- Add composite index for multi-column filters
- Check for type mismatches (text vs uuid)

### Redis Connection Issues

**Symptoms:** Cache health endpoint returns unhealthy

**Check:**
```typescript
console.log('Redis URL:', process.env.UPSTASH_REDIS_REST_URL)
console.log('Redis Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'Set' : 'Missing')
```

**Solutions:**
- Verify environment variables
- Check Upstash dashboard for IP restrictions
- Ensure Redis instance is running

## 10. Maintenance

### Weekly Tasks
- Review slow query log
- Check cache hit rates
- Monitor index usage

### Monthly Tasks
- Analyze and remove unused indexes
- Review cache TTL settings
- Check for index bloat and REINDEX if needed

### Quarterly Tasks
- Performance benchmark comparison
- Review and optimize top 10 slowest queries
- Capacity planning based on growth

---

**Remember:** Monitor first, optimize second. Use data to drive optimization decisions.
