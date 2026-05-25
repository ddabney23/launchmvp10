-- Enhanced Social Features Migration (Fixed - Idempotent)
-- Adds reactions, view counts, shares, hashtags, reposts, polls, tags, and analytics

-- 1. Add view count and share count to posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_repost BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

-- 2. Create reactions table (replaces simple likes with emoji reactions)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON public.post_reactions(user_id);

-- 3. Create post views table
CREATE TABLE IF NOT EXISTS public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id, viewer_ip)
);

CREATE INDEX IF NOT EXISTS idx_post_views_post ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user ON public.post_views(user_id);

-- 4. Create hashtags table
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 1,
  trending_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON public.hashtags(tag);
CREATE INDEX IF NOT EXISTS idx_hashtags_trending ON public.hashtags(trending_score DESC);

-- 5. Create post_hashtags junction table
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_hashtags_post ON public.post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag ON public.post_hashtags(hashtag_id);

-- 6. Create post_tags table (tagging users in posts)
CREATE TABLE IF NOT EXISTS public.post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  tagged_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_post ON public.post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_user ON public.post_tags(tagged_user_id);

-- 7. Create polls table
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  question TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create poll_options table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON public.poll_options(poll_id);

-- 9. Create poll_votes table
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON public.poll_votes(user_id);

-- 10. Create engagement events table (for analytics)
CREATE TABLE IF NOT EXISTS public.engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'like', 'comment', 'share', 'repost', 'poll_vote', 'tag')),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'story')),
  target_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_events_user ON public.engagement_events(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_target ON public.engagement_events(target_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_created ON public.engagement_events(created_at DESC);

-- 11. Function to increment view count
CREATE OR REPLACE FUNCTION increment_post_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_increment_view_count ON public.post_views;
CREATE TRIGGER trigger_increment_view_count
AFTER INSERT ON public.post_views
FOR EACH ROW
EXECUTE FUNCTION increment_post_view_count();

-- 12. Function to update hashtag trending score
CREATE OR REPLACE FUNCTION update_hashtag_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hashtags
  SET 
    usage_count = usage_count + 1,
    trending_score = (
      -- Weighted score: recent usage counts more
      (SELECT COUNT(*) FROM public.post_hashtags ph 
       JOIN public.posts p ON p.id = ph.post_id
       WHERE ph.hashtag_id = NEW.hashtag_id 
       AND p.created_at > NOW() - INTERVAL '24 hours'
      ) * 10 +
      (SELECT COUNT(*) FROM public.post_hashtags ph 
       WHERE ph.hashtag_id = NEW.hashtag_id
      )
    ),
    updated_at = NOW()
  WHERE id = NEW.hashtag_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_hashtag_trending ON public.post_hashtags;
CREATE TRIGGER trigger_update_hashtag_trending
AFTER INSERT ON public.post_hashtags
FOR EACH ROW
EXECUTE FUNCTION update_hashtag_trending_score();

-- 13. Function to increment poll option vote count
CREATE OR REPLACE FUNCTION increment_poll_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.poll_options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_poll_vote ON public.poll_votes;
CREATE TRIGGER trigger_increment_poll_vote
AFTER INSERT ON public.poll_votes
FOR EACH ROW
EXECUTE FUNCTION increment_poll_vote_count();

-- 14. Function to award points for engagement
CREATE OR REPLACE FUNCTION award_engagement_points()
RETURNS TRIGGER AS $$
DECLARE
  points_to_award INTEGER;
BEGIN
  -- Determine points based on event type
  CASE NEW.event_type
    WHEN 'view' THEN points_to_award := 0; -- No points for views
    WHEN 'like' THEN points_to_award := 1;
    WHEN 'comment' THEN points_to_award := 2;
    WHEN 'share' THEN points_to_award := 3;
    WHEN 'repost' THEN points_to_award := 3;
    WHEN 'poll_vote' THEN points_to_award := 1;
    WHEN 'tag' THEN points_to_award := 1;
    ELSE points_to_award := 0;
  END CASE;

  -- Award points if > 0
  IF points_to_award > 0 THEN
    PERFORM public.award_points(
      NEW.user_id::TEXT,
      points_to_award,
      NEW.event_type,
      jsonb_build_object('target_type', NEW.target_type, 'target_id', NEW.target_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_award_engagement_points ON public.engagement_events;
CREATE TRIGGER trigger_award_engagement_points
AFTER INSERT ON public.engagement_events
FOR EACH ROW
EXECUTE FUNCTION award_engagement_points();

-- 15. RLS Policies for new tables

-- Post reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reactions" ON public.post_reactions;
CREATE POLICY "Anyone can view reactions" ON public.post_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add their own reactions" ON public.post_reactions;
CREATE POLICY "Users can add their own reactions" ON public.post_reactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.post_reactions;
CREATE POLICY "Users can delete their own reactions" ON public.post_reactions
  FOR DELETE USING (true);

-- Post views
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record views" ON public.post_views;
CREATE POLICY "Anyone can record views" ON public.post_views
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view counts" ON public.post_views;
CREATE POLICY "Anyone can view counts" ON public.post_views
  FOR SELECT USING (true);

-- Hashtags
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view hashtags" ON public.hashtags;
CREATE POLICY "Anyone can view hashtags" ON public.hashtags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create hashtags" ON public.hashtags;
CREATE POLICY "Anyone can create hashtags" ON public.hashtags
  FOR INSERT WITH CHECK (true);

-- Post hashtags
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view post hashtags" ON public.post_hashtags;
CREATE POLICY "Anyone can view post hashtags" ON public.post_hashtags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can add hashtags" ON public.post_hashtags;
CREATE POLICY "Anyone can add hashtags" ON public.post_hashtags
  FOR INSERT WITH CHECK (true);

-- Post tags
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tags" ON public.post_tags;
CREATE POLICY "Anyone can view tags" ON public.post_tags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create tags" ON public.post_tags;
CREATE POLICY "Anyone can create tags" ON public.post_tags
  FOR INSERT WITH CHECK (true);

-- Polls
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view polls" ON public.polls;
CREATE POLICY "Anyone can view polls" ON public.polls
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create polls" ON public.polls;
CREATE POLICY "Anyone can create polls" ON public.polls
  FOR INSERT WITH CHECK (true);

-- Poll options
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view poll options" ON public.poll_options;
CREATE POLICY "Anyone can view poll options" ON public.poll_options
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create poll options" ON public.poll_options;
CREATE POLICY "Anyone can create poll options" ON public.poll_options
  FOR INSERT WITH CHECK (true);

-- Poll votes
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view poll votes" ON public.poll_votes;
CREATE POLICY "Anyone can view poll votes" ON public.poll_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can vote" ON public.poll_votes;
CREATE POLICY "Users can vote" ON public.poll_votes
  FOR INSERT WITH CHECK (true);

-- Engagement events
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own events" ON public.engagement_events;
CREATE POLICY "Users can view their own events" ON public.engagement_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create events" ON public.engagement_events;
CREATE POLICY "Anyone can create events" ON public.engagement_events
  FOR INSERT WITH CHECK (true);

-- 16. Comments for documentation
COMMENT ON TABLE public.post_reactions IS 'User reactions to posts (like, love, laugh, wow, sad, angry)';
COMMENT ON TABLE public.post_views IS 'Tracks post views for analytics and trending';
COMMENT ON TABLE public.hashtags IS 'Hashtag master table with trending scores';
COMMENT ON TABLE public.post_hashtags IS 'Links posts to hashtags';
COMMENT ON TABLE public.post_tags IS 'User mentions/tags in posts';
COMMENT ON TABLE public.polls IS 'Polls attached to posts';
COMMENT ON TABLE public.poll_options IS 'Options for each poll';
COMMENT ON TABLE public.poll_votes IS 'User votes on poll options';
COMMENT ON TABLE public.engagement_events IS 'Tracks all user engagement for analytics and gamification';
