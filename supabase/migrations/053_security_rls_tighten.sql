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
