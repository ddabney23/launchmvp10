-- Enable Row-Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_posts_public" ON public.posts;
DROP POLICY IF EXISTS "insert_posts" ON public.posts;
DROP POLICY IF EXISTS "update_own_posts" ON public.posts;
DROP POLICY IF EXISTS "delete_own_posts" ON public.posts;
DROP POLICY IF EXISTS "select_follows" ON public.follows;
DROP POLICY IF EXISTS "insert_follows" ON public.follows;
DROP POLICY IF EXISTS "delete_own_follows" ON public.follows;
DROP POLICY IF EXISTS "select_comments" ON public.comments;
DROP POLICY IF EXISTS "insert_comments" ON public.comments;
DROP POLICY IF EXISTS "delete_own_comments" ON public.comments;
DROP POLICY IF EXISTS "select_likes" ON public.likes;
DROP POLICY IF EXISTS "insert_likes" ON public.likes;
DROP POLICY IF EXISTS "delete_own_likes" ON public.likes;
DROP POLICY IF EXISTS "select_listings" ON public.listings;
DROP POLICY IF EXISTS "insert_listings_vendor" ON public.listings;
DROP POLICY IF EXISTS "update_own_listings" ON public.listings;
DROP POLICY IF EXISTS "delete_own_listings" ON public.listings;
DROP POLICY IF EXISTS "select_orders" ON public.orders;
DROP POLICY IF EXISTS "insert_orders" ON public.orders;
DROP POLICY IF EXISTS "update_own_orders" ON public.orders;
DROP POLICY IF EXISTS "select_order_items" ON public.order_items;
DROP POLICY IF EXISTS "select_bookings" ON public.bookings;
DROP POLICY IF EXISTS "insert_bookings" ON public.bookings;
DROP POLICY IF EXISTS "update_own_bookings" ON public.bookings;
DROP POLICY IF EXISTS "select_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
DROP POLICY IF EXISTS "update_own_messages" ON public.messages;
DROP POLICY IF EXISTS "select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "select_badges" ON public.badges;
DROP POLICY IF EXISTS "select_user_badges" ON public.user_badges;
DROP POLICY IF EXISTS "insert_user_badges" ON public.user_badges;

-- Profiles policies
CREATE POLICY "select_profiles" ON public.profiles
  FOR SELECT
  USING (true); -- Public read for basic profile fields

CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Posts policies
CREATE POLICY "select_posts_public" ON public.posts
  FOR SELECT
  USING (
    visibility = 'public' 
    OR author = auth.uid() 
    OR (
      visibility = 'followers' 
      AND EXISTS (
        SELECT 1 FROM public.follows 
        WHERE follower = auth.uid() 
        AND following = posts.author
      )
    )
  );

CREATE POLICY "insert_posts" ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = author);

CREATE POLICY "update_own_posts" ON public.posts
  FOR UPDATE
  USING (author = auth.uid());

CREATE POLICY "delete_own_posts" ON public.posts
  FOR DELETE
  USING (author = auth.uid());

-- Follows policies
CREATE POLICY "select_follows" ON public.follows
  FOR SELECT
  USING (true);

CREATE POLICY "insert_follows" ON public.follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower);

CREATE POLICY "delete_own_follows" ON public.follows
  FOR DELETE
  USING (auth.uid() = follower);

-- Comments policies
CREATE POLICY "select_comments" ON public.comments
  FOR SELECT
  USING (true);

CREATE POLICY "insert_comments" ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() = author);

CREATE POLICY "delete_own_comments" ON public.comments
  FOR DELETE
  USING (auth.uid() = author);

-- Likes policies
CREATE POLICY "select_likes" ON public.likes
  FOR SELECT
  USING (true);

CREATE POLICY "insert_likes" ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() = author);

CREATE POLICY "delete_own_likes" ON public.likes
  FOR DELETE
  USING (auth.uid() = author);

-- Listings policies
CREATE POLICY "select_listings" ON public.listings
  FOR SELECT
  USING (active = TRUE OR vendor = auth.uid());

CREATE POLICY "insert_listings_vendor" ON public.listings
  FOR INSERT
  WITH CHECK (
    auth.uid() = vendor 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_vendor = TRUE OR vendor_verified = TRUE)
    )
  );

CREATE POLICY "update_own_listings" ON public.listings
  FOR UPDATE
  USING (vendor = auth.uid());

CREATE POLICY "delete_own_listings" ON public.listings
  FOR DELETE
  USING (vendor = auth.uid());

-- Orders policies
CREATE POLICY "select_orders" ON public.orders
  FOR SELECT
  USING (buyer = auth.uid() OR vendor = auth.uid());

-- Note: Orders should only be created via Edge Functions with service role
-- This policy allows authenticated users to read their own orders
-- Edge functions use service role to bypass RLS

CREATE POLICY "update_own_orders" ON public.orders
  FOR UPDATE
  USING (vendor = auth.uid() OR buyer = auth.uid())
  WITH CHECK (vendor = auth.uid() OR buyer = auth.uid());

-- Order items policies
CREATE POLICY "select_order_items" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.buyer = auth.uid() OR orders.vendor = auth.uid())
    )
  );

-- Bookings policies
CREATE POLICY "select_bookings" ON public.bookings
  FOR SELECT
  USING (buyer = auth.uid() OR vendor = auth.uid());

CREATE POLICY "insert_bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (auth.uid() = buyer);

CREATE POLICY "update_own_bookings" ON public.bookings
  FOR UPDATE
  USING (vendor = auth.uid() OR buyer = auth.uid())
  WITH CHECK (vendor = auth.uid() OR buyer = auth.uid());

-- Messages policies
CREATE POLICY "select_messages" ON public.messages
  FOR SELECT
  USING (
    sender = auth.uid() 
    OR channel_id LIKE '%' || auth.uid()::text || '%'
  );

CREATE POLICY "insert_messages" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender);

CREATE POLICY "update_own_messages" ON public.messages
  FOR UPDATE
  USING (sender = auth.uid());

-- Notifications policies
CREATE POLICY "select_notifications" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "insert_notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (true); -- Edge functions can create notifications

CREATE POLICY "update_own_notifications" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- Badges policies
CREATE POLICY "select_badges" ON public.badges
  FOR SELECT
  USING (true);

-- User badges policies
CREATE POLICY "select_user_badges" ON public.user_badges
  FOR SELECT
  USING (true);

-- User badges should be awarded via triggers/functions, not direct insert
CREATE POLICY "insert_user_badges" ON public.user_badges
  FOR INSERT
  WITH CHECK (true); -- Allow via triggers/functions

