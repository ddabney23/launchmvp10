-- Migration: Performance Indexes
-- Adds indexes for frequently queried columns to improve query performance

-- Posts table indexes
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_posts_group_id ON public.posts(group_id) WHERE group_id IS NOT NULL;

-- Listings table indexes
CREATE INDEX IF NOT EXISTS idx_listings_vendor ON public.listings(vendor);
CREATE INDEX IF NOT EXISTS idx_listings_active ON public.listings(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer) WHERE buyer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor) WHERE vendor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Order items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing_id ON public.order_items(listing_id) WHERE listing_id IS NOT NULL;

-- Follows table indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following);

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- Likes table indexes
CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_author ON public.likes(author);

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender) WHERE sender IS NOT NULL;

-- Notifications table indexes (verify if exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_id') THEN
    CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_read') THEN
    CREATE INDEX idx_notifications_read ON public.notifications(read) WHERE read = false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_created_at') THEN
    CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
  END IF;
END $$;

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_vendor ON public.profiles(is_vendor) WHERE is_vendor = true;
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_verified ON public.profiles(vendor_verified) WHERE vendor_verified = true;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts(author, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_vendor_active ON public.listings(vendor, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders(buyer, status) WHERE buyer IS NOT NULL;

-- Full-text search indexes (if using pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text search indexes for posts content
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON public.posts USING gin(content gin_trgm_ops);

-- Text search indexes for listings title and description
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON public.listings USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_description_trgm ON public.listings USING gin(description gin_trgm_ops) WHERE description IS NOT NULL;

-- Text search indexes for profiles username and display_name
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON public.profiles USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm ON public.profiles USING gin(display_name gin_trgm_ops) WHERE display_name IS NOT NULL;

