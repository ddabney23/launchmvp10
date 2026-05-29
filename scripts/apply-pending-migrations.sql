-- apply-pending-migrations.sql (auto-generated)
-- Apply in Supabase Dashboard → SQL Editor when npm run supabase:push fails.
-- Regenerate: node scripts/build-apply-pending-migrations.mjs
--
-- Migrations included: 053_security_rls_tighten.sql, 054_fix_is_admin_rls_recursion.sql, 055_fix_profiles_update_rls.sql, 056_fix_posts_rls.sql, 057_fix_social_marketplace_rls.sql


-- ========== 053_security_rls_tighten.sql ==========

-- Migration 053: Tighten permissive RLS policies for Supabase Auth (auth.uid())
-- Skips broken 051_security_audit_rls.sql (wrong column names). Apply after 052.

-- Helper: current user is admin
-- Bypass RLS when reading profiles to avoid infinite recursion in policies.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- Backward-compatible overload for policies that call is_admin_user(auth.uid()).
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = user_uuid),
    FALSE
  );
$$;

-- ============================================
-- Stories
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'stories'
  ) THEN
    DROP POLICY IF EXISTS "select_public_stories" ON public.stories;
    DROP POLICY IF EXISTS "insert_own_stories" ON public.stories;
    DROP POLICY IF EXISTS "update_own_stories" ON public.stories;
    DROP POLICY IF EXISTS "delete_own_stories" ON public.stories;

    CREATE POLICY "select_public_stories" ON public.stories
      FOR SELECT
      USING (visibility = 'public' OR user_id = auth.uid() OR public.is_admin_user());

    CREATE POLICY "insert_own_stories" ON public.stories
      FOR INSERT
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY "update_own_stories" ON public.stories
      FOR UPDATE
      USING (user_id = auth.uid() OR public.is_admin_user())
      WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

    CREATE POLICY "delete_own_stories" ON public.stories
      FOR DELETE
      USING (user_id = auth.uid() OR public.is_admin_user());
  END IF;
END $$;

-- story_views
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'story_views'
  ) THEN
    DROP POLICY IF EXISTS "select_story_views" ON public.story_views;
    DROP POLICY IF EXISTS "insert_story_views" ON public.story_views;

    CREATE POLICY "select_story_views" ON public.story_views
      FOR SELECT
      USING (
        viewer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
        OR public.is_admin_user()
      );

    CREATE POLICY "insert_story_views" ON public.story_views
      FOR INSERT
      WITH CHECK (viewer_id = auth.uid());
  END IF;
END $$;

-- story_replies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'story_replies'
  ) THEN
    DROP POLICY IF EXISTS "select_story_replies" ON public.story_replies;
    DROP POLICY IF EXISTS "insert_story_replies" ON public.story_replies;
    DROP POLICY IF EXISTS "delete_own_story_replies" ON public.story_replies;

    CREATE POLICY "select_story_replies" ON public.story_replies
      FOR SELECT
      USING (
        sender_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
        OR public.is_admin_user()
      );

    CREATE POLICY "insert_story_replies" ON public.story_replies
      FOR INSERT
      WITH CHECK (sender_id = auth.uid());

    CREATE POLICY "delete_own_story_replies" ON public.story_replies
      FOR DELETE
      USING (sender_id = auth.uid() OR public.is_admin_user());
  END IF;
END $$;

-- story_likes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'story_likes'
  ) THEN
    DROP POLICY IF EXISTS "select_story_likes" ON public.story_likes;
    DROP POLICY IF EXISTS "insert_story_likes" ON public.story_likes;
    DROP POLICY IF EXISTS "delete_story_likes" ON public.story_likes;

    CREATE POLICY "select_story_likes" ON public.story_likes
      FOR SELECT
      USING (true);

    CREATE POLICY "insert_story_likes" ON public.story_likes
      FOR INSERT
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY "delete_story_likes" ON public.story_likes
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- Ads (public read active only; admin write)
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ads'
  ) THEN
    DROP POLICY IF EXISTS "Ads are publicly readable" ON public.ads;
    DROP POLICY IF EXISTS "Admins can insert ads" ON public.ads;
    DROP POLICY IF EXISTS "Admins can update ads" ON public.ads;
    DROP POLICY IF EXISTS "Admins can delete ads" ON public.ads;
  END IF;
END $$;

CREATE POLICY "Ads are publicly readable"
  ON public.ads
  FOR SELECT
  USING (
    is_active = TRUE
    AND (start_at IS NULL OR start_at <= NOW())
    AND (end_at IS NULL OR end_at > NOW())
  );

CREATE POLICY "Admins can insert ads"
  ON public.ads
  FOR INSERT
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can update ads"
  ON public.ads
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can delete ads"
  ON public.ads
  FOR DELETE
  USING (public.is_admin_user());

-- ============================================
-- Audit logs (admin only)
-- ============================================
DROP POLICY IF EXISTS "allow_audit_log_inserts" ON public.audit_logs;
DROP POLICY IF EXISTS "admins_can_view_audit_logs" ON public.audit_logs;

CREATE POLICY "admins_can_view_audit_logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_admin_user());

CREATE POLICY "admins_can_insert_audit_logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    public.is_admin_user()
    AND (user_id IS NULL OR user_id = auth.uid())
  );


-- ========== 054_fix_is_admin_rls_recursion.sql ==========

-- Fix infinite recursion when is_admin_user() reads profiles under RLS.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = user_uuid),
    FALSE
  );
$$;

-- Public read for published news (homepage, feed teasers).
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published news" ON public.news;
CREATE POLICY "Public can read published news"
  ON public.news
  FOR SELECT
  USING (is_published = TRUE);


-- ========== 055_fix_profiles_update_rls.sql ==========

-- Fix profiles UPDATE policy broken in 051 (used clerk_id instead of id).
-- Supabase Auth: profiles.id = auth.users.id = auth.uid()

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "Users can update own profile" ON public.profiles IS
  'Allows users to update their own profile (id matches auth.uid())';


-- ========== 056_fix_posts_rls.sql ==========

-- Fix posts RLS broken in 051 (wrong columns: author_id, published).
-- Schema uses posts.author and posts.visibility (see 001_init_schema.sql).

DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "select_posts_public" ON public.posts;
DROP POLICY IF EXISTS "insert_posts" ON public.posts;
DROP POLICY IF EXISTS "update_own_posts" ON public.posts;
DROP POLICY IF EXISTS "delete_own_posts" ON public.posts;

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
  WITH CHECK (author = auth.uid());

CREATE POLICY "update_own_posts" ON public.posts
  FOR UPDATE
  USING (author = auth.uid())
  WITH CHECK (author = auth.uid());

CREATE POLICY "delete_own_posts" ON public.posts
  FOR DELETE
  USING (author = auth.uid());


-- ========== 057_fix_social_marketplace_rls.sql ==========

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

