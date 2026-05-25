-- Migration: News table and additional schema extensions
-- This migration adds a news table for platform updates and extends the schema

-- News table for platform updates and announcements
CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  image_url TEXT,
  author UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'announcement' CHECK (category IN ('announcement', 'update', 'feature', 'community')),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add group_id to posts for group-specific posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Add leaderboard view/table for gamification
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  period TEXT DEFAULT 'all_time' CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  points INTEGER DEFAULT 0,
  rank INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, period)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_created_at ON public.news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news(category);
CREATE INDEX IF NOT EXISTS idx_news_published ON public.news(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_news_pinned ON public.news(is_pinned) WHERE is_pinned = TRUE;

CREATE INDEX IF NOT EXISTS idx_posts_group_id ON public.posts(group_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON public.leaderboard(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_points ON public.leaderboard(period, points DESC);

-- Function to update news updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.update_news_updated_at();

-- Function to increment news view count
CREATE OR REPLACE FUNCTION public.increment_news_view_count(news_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.news
  SET view_count = view_count + 1
  WHERE id = news_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

