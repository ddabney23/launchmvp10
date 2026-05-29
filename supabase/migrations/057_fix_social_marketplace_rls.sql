-- Fix comments, likes, follows, listings RLS broken in 051 (wrong column names).
-- Schema uses author, follower/following, vendor (see 001_init_schema.sql).

-- Comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Users can insert own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
DROP POLICY IF EXISTS "select_comments" ON public.comments;
DROP POLICY IF EXISTS "insert_comments" ON public.comments;
DROP POLICY IF EXISTS "delete_own_comments" ON public.comments;

CREATE POLICY "select_comments" ON public.comments
  FOR SELECT
  USING (true);

CREATE POLICY "insert_comments" ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() = author);

CREATE POLICY "delete_own_comments" ON public.comments
  FOR DELETE
  USING (auth.uid() = author);

-- Likes
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;
DROP POLICY IF EXISTS "select_likes" ON public.likes;
DROP POLICY IF EXISTS "insert_likes" ON public.likes;
DROP POLICY IF EXISTS "delete_own_likes" ON public.likes;

CREATE POLICY "select_likes" ON public.likes
  FOR SELECT
  USING (true);

CREATE POLICY "insert_likes" ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() = author);

CREATE POLICY "delete_own_likes" ON public.likes
  FOR DELETE
  USING (auth.uid() = author);

-- Follows
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow others" ON public.follows;
DROP POLICY IF EXISTS "select_follows" ON public.follows;
DROP POLICY IF EXISTS "insert_follows" ON public.follows;
DROP POLICY IF EXISTS "delete_own_follows" ON public.follows;

CREATE POLICY "select_follows" ON public.follows
  FOR SELECT
  USING (true);

CREATE POLICY "insert_follows" ON public.follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower);

CREATE POLICY "delete_own_follows" ON public.follows
  FOR DELETE
  USING (auth.uid() = follower);

-- Listings
DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON public.listings;
DROP POLICY IF EXISTS "Vendors can insert own listings" ON public.listings;
DROP POLICY IF EXISTS "Vendors can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Vendors can delete own listings" ON public.listings;
DROP POLICY IF EXISTS "select_listings" ON public.listings;
DROP POLICY IF EXISTS "insert_listings_vendor" ON public.listings;
DROP POLICY IF EXISTS "update_own_listings" ON public.listings;
DROP POLICY IF EXISTS "delete_own_listings" ON public.listings;

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
