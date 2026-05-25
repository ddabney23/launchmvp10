-- Performance Indexes Migration
-- Created: 2024
-- Purpose: Add indexes to improve query performance for high-traffic routes

-- =======================
-- POSTS PERFORMANCE INDEXES
-- =======================

-- Index for user's posts query (profile page, user timeline)
-- Covers: SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_user_created 
ON posts(user_id, created_at DESC) 
WHERE is_deleted = false;

-- Index for post by ID with deleted filter
-- Covers: SELECT * FROM posts WHERE id = ? AND is_deleted = false
CREATE INDEX IF NOT EXISTS idx_posts_id_deleted 
ON posts(id) 
WHERE is_deleted = false;

-- Index for trending/popular posts (global feed)
-- Covers: SELECT * FROM posts WHERE is_deleted = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_created_deleted 
ON posts(created_at DESC) 
WHERE is_deleted = false;

-- =======================
-- COMMENTS PERFORMANCE INDEXES
-- =======================

-- Index for comments on a post (post detail page)
-- Covers: SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created 
ON post_comments(post_id, created_at ASC);

-- Index for user's comments
-- Covers: SELECT * FROM post_comments WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_post_comments_user_created 
ON post_comments(user_id, created_at DESC);

-- =======================
-- SOCIAL FEATURES INDEXES
-- =======================

-- Index for following list (who user follows)
-- Covers: SELECT * FROM follows WHERE follower_id = ?
CREATE INDEX IF NOT EXISTS idx_follows_follower 
ON follows(follower_id);

-- Index for followers list (who follows user)
-- Covers: SELECT * FROM follows WHERE following_id = ?
CREATE INDEX IF NOT EXISTS idx_follows_following 
ON follows(following_id);

-- Composite index for follow relationship check
-- Covers: SELECT * FROM follows WHERE follower_id = ? AND following_id = ?
CREATE INDEX IF NOT EXISTS idx_follows_relationship 
ON follows(follower_id, following_id);

-- Index for post likes count
-- Covers: SELECT COUNT(*) FROM post_likes WHERE post_id = ?
CREATE INDEX IF NOT EXISTS idx_post_likes_post 
ON post_likes(post_id);

-- Index for user's liked posts
-- Covers: SELECT * FROM post_likes WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_post_likes_user 
ON post_likes(user_id);

-- Composite index for like check (has user liked post?)
-- Covers: SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?
CREATE INDEX IF NOT EXISTS idx_post_likes_check 
ON post_likes(post_id, user_id);

-- =======================
-- NOTIFICATIONS PERFORMANCE INDEXES
-- =======================

-- Index for user's unread notifications (notification feed)
-- Covers: SELECT * FROM notifications WHERE user_id = ? AND is_read = false ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created 
ON notifications(user_id, is_read, created_at DESC);

-- Index for all user notifications
-- Covers: SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- =======================
-- VENDOR/LISTINGS INDEXES
-- =======================

-- Index for vendor's listings
-- Covers: SELECT * FROM listings WHERE vendor_id = ?
CREATE INDEX IF NOT EXISTS idx_listings_vendor 
ON listings(vendor_id);

-- Index for active listings
-- Covers: SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_listings_active_created 
ON listings(status, created_at DESC);

-- Index for listing categories
-- Covers: SELECT * FROM listings WHERE category = ?
CREATE INDEX IF NOT EXISTS idx_listings_category 
ON listings(category);

-- =======================
-- ORDERS/BOOKINGS INDEXES
-- =======================

-- Index for buyer's orders
-- Covers: SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created 
ON orders(buyer_id, created_at DESC);

-- Index for vendor's orders (sales)
-- Covers: SELECT * FROM orders WHERE vendor_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_vendor_created 
ON orders(vendor_id, created_at DESC);

-- Index for bookings by vendor
-- Covers: SELECT * FROM bookings WHERE vendor_id = ?
CREATE INDEX IF NOT EXISTS idx_bookings_vendor 
ON bookings(vendor_id);

-- Index for bookings by user
-- Covers: SELECT * FROM bookings WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_bookings_user 
ON bookings(user_id);

-- =======================
-- GAMIFICATION INDEXES
-- =======================

-- Index for user badges (profile achievements)
-- Covers: SELECT * FROM user_badges WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_user_badges_user 
ON user_badges(user_id);

-- Index for leaderboard queries
-- Covers: SELECT * FROM profiles ORDER BY points DESC, level DESC
CREATE INDEX IF NOT EXISTS idx_profiles_points_level 
ON profiles(points DESC, level DESC);

-- =======================
-- ANALYTICS INDEXES
-- =======================

-- Index for user activity tracking
-- Covers: SELECT * FROM profiles WHERE created_at > ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_profiles_created_active 
ON profiles(created_at DESC) 
WHERE is_active = true;

-- =======================
-- VERIFICATION/ADMIN INDEXES
-- =======================

-- Index for pending vendor applications (admin review queue)
-- Covers: SELECT * FROM vendor_applications WHERE status = 'pending' ORDER BY submitted_at ASC
CREATE INDEX IF NOT EXISTS idx_vendor_applications_pending 
ON vendor_applications(status, submitted_at ASC);

-- Index for user's vendor application
-- Covers: SELECT * FROM vendor_applications WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_vendor_applications_user 
ON vendor_applications(user_id);

-- =======================
-- PROFILES LOOKUP INDEXES
-- =======================

-- Index for Clerk user ID lookup (authentication queries)
-- Covers: SELECT * FROM profiles WHERE clerk_user_id = ?
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id 
ON profiles(clerk_user_id);

-- Index for username lookup (profile pages)
-- Covers: SELECT * FROM profiles WHERE username = ?
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username);

-- Index for admin users
-- Covers: SELECT * FROM profiles WHERE is_admin = true
CREATE INDEX IF NOT EXISTS idx_profiles_admin 
ON profiles(is_admin) 
WHERE is_admin = true;

-- Index for verified vendors
-- Covers: SELECT * FROM profiles WHERE vendor_verified = true
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_verified 
ON profiles(vendor_verified) 
WHERE vendor_verified = true;

-- =======================
-- POST IMAGES INDEX
-- =======================

-- Index for post images (post detail page)
-- Covers: SELECT * FROM post_images WHERE post_id = ? ORDER BY order_index ASC
CREATE INDEX IF NOT EXISTS idx_post_images_post_order 
ON post_images(post_id, order_index ASC);

-- =======================
-- PERFORMANCE NOTES
-- =======================

-- These indexes are designed to:
-- 1. Speed up common read queries (posts feed, notifications, profile lookups)
-- 2. Optimize foreign key lookups (user_id, post_id, vendor_id)
-- 3. Support sorting operations (created_at DESC, points DESC)
-- 4. Filter deleted/inactive records efficiently (WHERE is_deleted = false)
--
-- Expected Impact:
-- - Posts queries: 50-80% faster (index on user_id, created_at)
-- - Notifications: 60-90% faster (index on user_id, is_read, created_at)
-- - Social features: 70-85% faster (composite indexes on follows, likes)
-- - Profile lookups: 90%+ faster (index on clerk_user_id, username)
--
-- Monitoring:
-- - Run EXPLAIN ANALYZE on slow queries to verify index usage
-- - Monitor index bloat with pg_stat_user_indexes
-- - Consider partial indexes for large tables with common filters
