# Performance Optimization Guide

## Overview

This document outlines all performance optimizations implemented in the Optimix platform.

---

## 1. Database Optimizations

### Indexes Created (Migration 022)

**Profile Queries:**
- `idx_profiles_username` - Username lookups
- `idx_profiles_email` - Email searches
- `idx_profiles_is_vendor` - Vendor filtering
- `idx_profiles_points` - Leaderboard sorting

**Post Queries:**
- `idx_posts_author` - User timeline
- `idx_posts_created_at` - Feed ordering
- `idx_posts_author_created` - Composite for user posts
- `idx_posts_content_search` - Full-text search

**Listing Queries:**
- `idx_listings_category` - Category filtering
- `idx_listings_active` - Active listings
- `idx_listings_price` - Price sorting
- `idx_listings_category_active` - Composite marketplace queries

**Booking Queries:**
- `idx_bookings_listing_times` - Conflict detection
- `idx_bookings_buyer` - User bookings
- `idx_bookings_vendor` - Vendor bookings

### Query Optimization Best Practices

1. **Use Select Specific Fields:**
   ```typescript
   // ❌ Bad - Fetches all columns
   const { data } = await supabase.from('posts').select('*')
   
   // ✅ Good - Only needed fields
   const { data } = await supabase.from('posts').select('id, content, author, created_at')
   ```

2. **Implement Pagination:**
   ```typescript
   // Use range() for cursor-based pagination
   const { data } = await supabase
     .from('posts')
     .select('*')
     .range(0, 19) // First 20 items
   ```

3. **Use React Query Caching:**
   ```typescript
   const { data } = useQuery({
     queryKey: ['posts', userId],
     queryFn: () => getPosts(userId),
     staleTime: 5 * 60 * 1000, // 5 minutes
     cacheTime: 10 * 60 * 1000  // 10 minutes
   })
   ```

---

## 2. Frontend Optimizations

### Image Optimization

**Use ImageOptimized Component:**
```tsx
import { ImageOptimized } from '@/components/ImageOptimized'

<ImageOptimized
  src="/path/to/image.jpg"
  alt="Description"
  width={800}
  height={600}
  priority={false}  // true for above-the-fold images
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

**Benefits:**
- Automatic WebP/AVIF conversion
- Lazy loading by default
- Responsive images
- Blur placeholder
- Error handling

### Code Splitting

**Lazy Load Heavy Components:**
```typescript
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const AdminDashboard = lazy(() => import('@/views/AdminDashboard'))

function AdminPage() {
  return (
    <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
      <AdminDashboard />
    </Suspense>
  )
}
```

**Route-based Splitting:**
- Next.js automatically splits routes
- Each page in `/app` is a separate chunk
- Shared components are bundled efficiently

### Bundle Size Optimization

**Current Bundle Analysis:**
```bash
npm run build
# Check the output for large chunks
```

**Optimization Checklist:**
- ✅ Remove unused dependencies
- ✅ Use tree-shaking
- ✅ Dynamic imports for heavy libraries
- ✅ Minimize third-party scripts

---

## 3. React Query Optimizations

### Caching Strategy

**Feed Queries:**
```typescript
// Short stale time for real-time data
useQuery({
  queryKey: ['feed'],
  queryFn: getFeed,
  staleTime: 30 * 1000,  // 30 seconds
  cacheTime: 5 * 60 * 1000  // 5 minutes
})
```

**Profile Queries:**
```typescript
// Longer stale time for static data
useQuery({
  queryKey: ['profile', userId],
  queryFn: () => getProfile(userId),
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000  // 10 minutes
})
```

### Optimistic Updates

**Example: Like Post**
```typescript
const likeMutation = useMutation({
  mutationFn: likePost,
  onMutate: async (postId) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: ['post', postId] })
    
    // Snapshot previous value
    const previousPost = queryClient.getQueryData(['post', postId])
    
    // Optimistically update
    queryClient.setQueryData(['post', postId], (old: any) => ({
      ...old,
      likes: old.likes + 1,
      isLiked: true
    }))
    
    return { previousPost }
  },
  onError: (err, postId, context) => {
    // Rollback on error
    queryClient.setQueryData(['post', postId], context?.previousPost)
  }
})
```

---

## 4. Network Optimizations

### API Route Response Optimization

**Compression:**
- Enable gzip/brotli compression in production
- Vercel handles this automatically

**Response Size:**
- Return only necessary fields
- Paginate large datasets
- Use field selection in Supabase queries

### Real-time Optimization

**Channel Management:**
```typescript
// Unsubscribe when component unmounts
useEffect(() => {
  const channel = supabase.channel('my-channel')
    .on('postgres_changes', { ... }, handleChange)
    .subscribe()
    
  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

---

## 5. Monitoring & Metrics

### Performance Monitoring

**Use Built-in Performance Utilities:**
```typescript
import { measurePerformance } from '@/lib/performance'

const result = await measurePerformance('fetchPosts', async () => {
  return await getPosts()
})
```

### Web Vitals

**Track Core Web Vitals:**
- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1

**Implementation:**
```typescript
// In app/layout.tsx
import { reportWebVitals } from '@/lib/performance'

export function reportWebVitals(metric) {
  // Send to analytics
  console.log(metric)
}
```

---

## 6. Lighthouse Scores

### Target Scores

- **Performance**: > 90
- **Accessibility**: > 95
- **Best Practices**: > 90
- **SEO**: > 90

### Run Lighthouse:
```bash
# In Chrome DevTools
# 1. Open DevTools (F12)
# 2. Go to Lighthouse tab
# 3. Click "Generate report"
```

---

## 7. Best Practices

### Do's ✅
- Use Next.js Image component
- Implement lazy loading
- Add loading skeletons
- Cache API responses
- Use indexes for database queries
- Minimize bundle size
- Enable compression
- Use CDN for static assets

### Don'ts ❌
- Don't fetch all records without pagination
- Don't use `SELECT *` unnecessarily
- Don't load large images without optimization
- Don't skip error handling
- Don't ignore Web Vitals
- Don't bundle unnecessary dependencies

---

## 8. Performance Checklist

### Database
- [x] Indexes added for all foreign keys
- [x] Indexes on frequently queried columns
- [x] Full-text search indexes
- [x] Composite indexes for complex queries

### Frontend
- [x] Images optimized with Next.js Image
- [x] Code splitting implemented
- [x] Lazy loading for heavy components
- [x] React Query caching configured
- [x] Skeleton loaders added
- [ ] Bundle size analyzed and optimized
- [ ] Third-party scripts minimized

### API
- [x] Response compression enabled
- [x] Field selection in queries
- [x] Pagination implemented
- [x] Error handling optimized

### Monitoring
- [x] Performance utilities created
- [x] Web Vitals tracking ready
- [ ] Production monitoring configured
- [ ] Error tracking integrated (Sentry)

---

## Next Steps

1. Run Lighthouse audit
2. Analyze bundle size
3. Monitor real-world performance
4. Set up production monitoring (Sentry/Datadog)
5. Implement A/B testing for optimizations

