-- Migration: Create profile_badges table for many-to-many relationship
-- This replaces the user_badges table with a more flexible many-to-many structure

-- Drop existing user_badges table if it exists (optional - comment out if you want to keep it)
-- DROP TABLE IF EXISTS public.user_badges CASCADE;

-- Create profile_badges junction table
CREATE TABLE IF NOT EXISTS public.profile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure a profile can only have a badge once
  UNIQUE(profile_id, badge_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profile_badges_profile_id ON public.profile_badges(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_badges_badge_id ON public.profile_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_profile_badges_awarded_at ON public.profile_badges(awarded_at DESC);

-- Enable RLS
ALTER TABLE public.profile_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies (commented out for Clerk compatibility - using admin client)
-- Users can view their own badges
-- CREATE POLICY "Users can view their own badges"
--   ON public.profile_badges
--   FOR SELECT
--   USING (auth.uid() = profile_id);

-- Admins can view all badges
-- CREATE POLICY "Admins can view all badges"
--   ON public.profile_badges
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND is_admin = true
--     )
--   );

-- Admins can insert badges
-- CREATE POLICY "Admins can insert badges"
--   ON public.profile_badges
--   FOR INSERT
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND is_admin = true
--     )
--   );

-- Admins can delete badges
-- CREATE POLICY "Admins can delete badges"
--   ON public.profile_badges
--   FOR DELETE
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND is_admin = true
--     )
--   );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_profile_badges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_badges_updated_at
  BEFORE UPDATE ON public.profile_badges
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_badges_updated_at();

-- Add comment to table
COMMENT ON TABLE public.profile_badges IS 'Many-to-many relationship between profiles and badges';
COMMENT ON COLUMN public.profile_badges.profile_id IS 'Reference to the profile that has the badge';
COMMENT ON COLUMN public.profile_badges.badge_id IS 'Reference to the badge';
COMMENT ON COLUMN public.profile_badges.awarded_at IS 'When the badge was awarded';
COMMENT ON COLUMN public.profile_badges.awarded_by IS 'Admin who awarded the badge (if applicable)';
COMMENT ON COLUMN public.profile_badges.notes IS 'Optional notes about the badge award';

