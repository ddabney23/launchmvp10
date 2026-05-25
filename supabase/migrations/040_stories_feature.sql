-- Stories Feature Migration
-- Adds Instagram-style ephemeral 24-hour stories
-- Date: 2025-01

-- ============================================
-- 1. Create stories table
-- ============================================
-- Drop table if it exists with wrong structure (idempotent)
DROP TABLE IF EXISTS public.stories CASCADE;

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers')),
  view_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON public.stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_created ON public.stories(created_at DESC);
-- Note: Partial index with NOW() removed - NOW() is not IMMUTABLE
-- Regular index on expires_at is sufficient for queries with WHERE expires_at > NOW()

-- ============================================
-- 2. Create story_views table
-- ============================================
-- Drop table if it exists (idempotent)
DROP TABLE IF EXISTS public.story_views CASCADE;

CREATE TABLE public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON public.story_views(viewer_id);

-- ============================================
-- 3. Create story_replies table
-- ============================================
-- Drop table if it exists (idempotent)
DROP TABLE IF EXISTS public.story_replies CASCADE;

CREATE TABLE public.story_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_replies_story ON public.story_replies(story_id);
CREATE INDEX IF NOT EXISTS idx_story_replies_sender ON public.story_replies(sender_id);

-- ============================================
-- 3b. Create story_likes table
-- ============================================
-- Drop table if it exists (idempotent)
DROP TABLE IF EXISTS public.story_likes CASCADE;

CREATE TABLE public.story_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id) -- A user can only like a story once
);

CREATE INDEX IF NOT EXISTS idx_story_likes_story ON public.story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user ON public.story_likes(user_id);

-- ============================================
-- 4. Function to increment story view count
-- ============================================
CREATE OR REPLACE FUNCTION increment_story_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stories
  SET view_count = view_count + 1
  WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_increment_story_view_count ON public.story_views;
CREATE TRIGGER trigger_increment_story_view_count
AFTER INSERT ON public.story_views
FOR EACH ROW
EXECUTE FUNCTION increment_story_view_count();

-- ============================================
-- 5. Function to cleanup expired stories
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stories
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================
-- 6. Function to get active stories with view status
-- ============================================
CREATE OR REPLACE FUNCTION get_active_stories(user_uuid UUID)
RETURNS TABLE (
  story_id UUID,
  user_id UUID,
  media_url TEXT,
  media_type TEXT,
  caption TEXT,
  visibility TEXT,
  view_count INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_viewed BOOLEAN,
  reply_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS story_id,
    s.user_id,
    s.media_url,
    s.media_type,
    s.caption,
    s.visibility,
    s.view_count,
    s.expires_at,
    s.created_at,
    p.username,
    p.display_name,
    p.avatar_url,
    CASE 
      WHEN sv.viewer_id IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS is_viewed,
    COALESCE(reply_counts.count, 0)::BIGINT AS reply_count
  FROM public.stories s
  JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.story_views sv ON sv.story_id = s.id AND sv.viewer_id = user_uuid
  LEFT JOIN (
    SELECT sr.story_id AS story_id, COUNT(*) AS count
    FROM public.story_replies sr
    GROUP BY sr.story_id
  ) reply_counts ON reply_counts.story_id = s.id
  WHERE s.expires_at > NOW()
  ORDER BY 
    CASE WHEN sv.viewer_id IS NULL THEN 0 ELSE 1 END, -- Unviewed first
    s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================
-- 7. Enable RLS on stories tables
-- ============================================
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS Policies for stories table
-- ============================================

-- Select: Users can see public stories or stories from users they follow
-- Note: Since we're using Clerk, auth.uid() won't work. API routes use admin client.
-- This policy allows public stories and stories from followed users (when auth context is available)
CREATE POLICY "select_public_stories" ON public.stories
  FOR SELECT
  USING (
    visibility = 'public'
    -- Allow all authenticated users to see public stories
    -- API routes handle authorization via Clerk
  );

-- Insert: Users can create stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "insert_own_stories" ON public.stories
  FOR INSERT
  WITH CHECK (true); -- API routes handle authorization

-- Update: Users can update stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "update_own_stories" ON public.stories
  FOR UPDATE
  USING (true); -- API routes handle authorization

-- Delete: Users can delete stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "delete_own_stories" ON public.stories
  FOR DELETE
  USING (true); -- API routes handle authorization

-- ============================================
-- 9. RLS Policies for story_views table
-- ============================================

-- Select: Users can see views on stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "select_story_views" ON public.story_views
  FOR SELECT
  USING (true); -- API routes handle authorization

-- Insert: Users can record views on any story
-- Note: API routes handle authorization via Clerk
CREATE POLICY "insert_story_views" ON public.story_views
  FOR INSERT
  WITH CHECK (true); -- API routes handle authorization

-- ============================================
-- 10. RLS Policies for story_replies table
-- ============================================

-- Select: Users can see replies to stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "select_story_replies" ON public.story_replies
  FOR SELECT
  USING (true); -- API routes handle authorization

-- Insert: Users can reply to stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "insert_story_replies" ON public.story_replies
  FOR INSERT
  WITH CHECK (true); -- API routes handle authorization

-- Delete: Users can delete replies
-- Note: API routes handle authorization via Clerk
CREATE POLICY "delete_own_story_replies" ON public.story_replies
  FOR DELETE
  USING (true); -- API routes handle authorization

-- ============================================
-- 10b. RLS Policies for story_likes table
-- ============================================

-- Select: Users can see likes on stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "select_story_likes" ON public.story_likes
  FOR SELECT
  USING (true); -- API routes handle authorization

-- Insert: Users can like stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "insert_story_likes" ON public.story_likes
  FOR INSERT
  WITH CHECK (true); -- API routes handle authorization

-- Delete: Users can unlike stories
-- Note: API routes handle authorization via Clerk
CREATE POLICY "delete_story_likes" ON public.story_likes
  FOR DELETE
  USING (true); -- API routes handle authorization

-- ============================================
-- 11. Enable Realtime for stories
-- ============================================
-- Add tables to realtime publication (idempotent - will fail silently if already added)
DO $$
BEGIN
  -- Add stories table to realtime
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stories') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END IF;

  -- Add story_views table to realtime
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_views') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END IF;

  -- Add story_replies table to realtime
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_replies') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.story_replies;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END IF;

  -- Add story_likes table to realtime
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'story_likes') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END IF;
END $$;

-- ============================================
-- 12. Add updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_update_stories_updated_at ON public.stories;
CREATE TRIGGER trigger_update_stories_updated_at
BEFORE UPDATE ON public.stories
FOR EACH ROW
EXECUTE FUNCTION update_stories_updated_at();

