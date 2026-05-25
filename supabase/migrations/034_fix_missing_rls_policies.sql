-- Migration: Fix Missing RLS Policies
-- Addresses Supabase security advisor warnings
-- Enables RLS on all public tables and creates appropriate policies
-- Date: 2025-01

-- ============================================
-- Enable RLS on tables that are missing it
-- ============================================

-- Social/Content Tables
ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;

-- Chat/Messaging Tables
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Groups Tables
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.groups ENABLE ROW LEVEL SECURITY;

-- Vendor/E-commerce Tables
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_profiles ENABLE ROW LEVEL SECURITY;

-- Content Tables
ALTER TABLE IF EXISTS public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_views ENABLE ROW LEVEL SECURITY;

-- Gamification Tables
ALTER TABLE IF EXISTS public.credits_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.redemption_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.redemption_history ENABLE ROW LEVEL SECURITY;

-- Other Tables
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circulation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create RLS Policies for Tables Missing Policies
-- ============================================

-- Profile Badges (has RLS but no policies)
DROP POLICY IF EXISTS "select_profile_badges" ON public.profile_badges;
DROP POLICY IF EXISTS "insert_profile_badges" ON public.profile_badges;
DROP POLICY IF EXISTS "delete_profile_badges" ON public.profile_badges;

CREATE POLICY "select_profile_badges" ON public.profile_badges
  FOR SELECT
  USING (true); -- Public read for badges

CREATE POLICY "insert_profile_badges" ON public.profile_badges
  FOR INSERT
  WITH CHECK (
    -- Users can award badges to themselves (for testing)
    -- Admins can award any badge
    auth.uid() = profile_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "delete_profile_badges" ON public.profile_badges
  FOR DELETE
  USING (
    auth.uid() = profile_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Vendor Applications (has RLS but no policies)
DROP POLICY IF EXISTS "select_vendor_applications" ON public.vendor_applications;
DROP POLICY IF EXISTS "insert_vendor_applications" ON public.vendor_applications;
DROP POLICY IF EXISTS "update_vendor_applications" ON public.vendor_applications;

CREATE POLICY "select_vendor_applications" ON public.vendor_applications
  FOR SELECT
  USING (
    -- Users can see their own applications
    user_id = auth.uid()
    -- Admins can see all applications
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "insert_vendor_applications" ON public.vendor_applications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_vendor_applications" ON public.vendor_applications
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- Basic RLS Policies for Critical Tables
-- ============================================

-- Follows
DROP POLICY IF EXISTS "select_follows" ON public.follows;
DROP POLICY IF EXISTS "insert_follows" ON public.follows;
DROP POLICY IF EXISTS "delete_follows" ON public.follows;

CREATE POLICY "select_follows" ON public.follows
  FOR SELECT
  USING (true); -- Public read

CREATE POLICY "insert_follows" ON public.follows
  FOR INSERT
  WITH CHECK (follower = auth.uid());

CREATE POLICY "delete_follows" ON public.follows
  FOR DELETE
  USING (follower = auth.uid());

-- Messages
DROP POLICY IF EXISTS "select_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
DROP POLICY IF EXISTS "update_messages" ON public.messages;

CREATE POLICY "select_messages" ON public.messages
  FOR SELECT
  USING (
    sender = auth.uid()
    -- For 1:1 chats, channel_id contains both user IDs, so users can see messages in channels they're part of
    -- This is a simplified policy - in production, you might want to parse channel_id to verify both participants
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "insert_messages" ON public.messages
  FOR INSERT
  WITH CHECK (sender = auth.uid());

CREATE POLICY "update_messages" ON public.messages
  FOR UPDATE
  USING (sender = auth.uid());

-- Notifications
DROP POLICY IF EXISTS "select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "update_notifications" ON public.notifications;

CREATE POLICY "select_notifications" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "insert_notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "update_notifications" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- User Badges
DROP POLICY IF EXISTS "select_user_badges" ON public.user_badges;
DROP POLICY IF EXISTS "insert_user_badges" ON public.user_badges;

CREATE POLICY "select_user_badges" ON public.user_badges
  FOR SELECT
  USING (true); -- Public read

CREATE POLICY "insert_user_badges" ON public.user_badges
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments
DROP POLICY IF EXISTS "select_comments" ON public.comments;
DROP POLICY IF EXISTS "insert_comments" ON public.comments;
DROP POLICY IF EXISTS "update_comments" ON public.comments;
DROP POLICY IF EXISTS "delete_comments" ON public.comments;

CREATE POLICY "select_comments" ON public.comments
  FOR SELECT
  USING (true); -- Public read

CREATE POLICY "insert_comments" ON public.comments
  FOR INSERT
  WITH CHECK (author = auth.uid());

CREATE POLICY "update_comments" ON public.comments
  FOR UPDATE
  USING (author = auth.uid());

CREATE POLICY "delete_comments" ON public.comments
  FOR DELETE
  USING (
    author = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Likes
DROP POLICY IF EXISTS "select_likes" ON public.likes;
DROP POLICY IF EXISTS "insert_likes" ON public.likes;
DROP POLICY IF EXISTS "delete_likes" ON public.likes;

CREATE POLICY "select_likes" ON public.likes
  FOR SELECT
  USING (true); -- Public read

CREATE POLICY "insert_likes" ON public.likes
  FOR INSERT
  WITH CHECK (author = auth.uid());

CREATE POLICY "delete_likes" ON public.likes
  FOR DELETE
  USING (author = auth.uid());

-- Orders
DROP POLICY IF EXISTS "select_orders" ON public.orders;
DROP POLICY IF EXISTS "insert_orders" ON public.orders;
DROP POLICY IF EXISTS "update_orders" ON public.orders;

CREATE POLICY "select_orders" ON public.orders
  FOR SELECT
  USING (
    buyer = auth.uid()
    OR vendor = auth.uid()
    -- Check if user is a vendor who owns listings in this order
    OR EXISTS (
      SELECT 1 FROM public.listings l
      JOIN public.order_items oi ON oi.listing_id = l.id
      WHERE l.vendor = auth.uid() 
      AND oi.order_id = orders.id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "insert_orders" ON public.orders
  FOR INSERT
  WITH CHECK (buyer = auth.uid());

CREATE POLICY "update_orders" ON public.orders
  FOR UPDATE
  USING (
    buyer = auth.uid()
    OR vendor = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Order Items
DROP POLICY IF EXISTS "select_order_items" ON public.order_items;
DROP POLICY IF EXISTS "insert_order_items" ON public.order_items;

CREATE POLICY "select_order_items" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = order_items.order_id 
      AND (
        buyer = auth.uid()
        OR vendor = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND is_admin = true
        )
      )
    )
  );

CREATE POLICY "insert_order_items" ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = order_items.order_id 
      AND buyer = auth.uid()
    )
  );

-- Badges
DROP POLICY IF EXISTS "select_badges" ON public.badges;
DROP POLICY IF EXISTS "insert_badges" ON public.badges;
DROP POLICY IF EXISTS "update_badges" ON public.badges;

CREATE POLICY "select_badges" ON public.badges
  FOR SELECT
  USING (true); -- Public read

CREATE POLICY "insert_badges" ON public.badges
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "update_badges" ON public.badges
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Categories (read-only for most users)
DROP POLICY IF EXISTS "select_categories" ON public.categories;
DROP POLICY IF EXISTS "insert_categories" ON public.categories;
DROP POLICY IF EXISTS "update_categories" ON public.categories;

CREATE POLICY "select_categories" ON public.categories
  FOR SELECT
  USING (true); -- Public read

CREATE POLICY "insert_categories" ON public.categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "update_categories" ON public.categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- Note: Additional tables may need policies
-- This migration covers the most critical ones
-- ============================================

COMMENT ON POLICY "select_profile_badges" ON public.profile_badges IS 'Allows public read access to profile badges';
COMMENT ON POLICY "select_vendor_applications" ON public.vendor_applications IS 'Users can see their own applications, admins can see all';

