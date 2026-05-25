-- Performance Optimization: Add indexes for frequently queried columns
-- Created: 2025-01-11

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_vendor ON public.profiles(is_vendor) WHERE is_vendor = true;
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_verified ON public.profiles(vendor_verified) WHERE vendor_verified = true;
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

-- Posts indexes  
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts(author, created_at DESC);

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_vendor ON public.listings(vendor);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_active ON public.listings(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_listings_price ON public.listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category_active ON public.listings(category, active) WHERE active = true;

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders(buyer, status);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON public.bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer ON public.bookings(buyer);
CREATE INDEX IF NOT EXISTS idx_bookings_vendor ON public.bookings(vendor);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON public.bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_listing_times ON public.bookings(listing_id, start_time, end_time);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Likes indexes
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_target_id ON public.likes(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_likes_user_target ON public.likes(user_id, target_id, target_type);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- Follows indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- Full text search indexes (for better search performance)
CREATE INDEX IF NOT EXISTS idx_posts_content_search ON public.posts USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_listings_title_search ON public.listings USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_listings_description_search ON public.listings USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_profiles_username_search ON public.profiles USING gin(to_tsvector('english', username));

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_order_items_order_listing ON public.order_items(order_id, listing_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_badge ON public.user_badges(user_id, badge_id);

COMMENT ON INDEX idx_profiles_points IS 'For leaderboard queries';
COMMENT ON INDEX idx_posts_author_created IS 'For user timeline queries';
COMMENT ON INDEX idx_listings_category_active IS 'For marketplace category filtering';
COMMENT ON INDEX idx_notifications_user_read IS 'For unread notifications count';
COMMENT ON INDEX idx_bookings_listing_times IS 'For conflict detection queries';

