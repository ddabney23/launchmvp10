-- Add default_post_visibility column to profiles table
-- This allows users to set their preferred default visibility for posts

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_post_visibility TEXT DEFAULT 'followers' 
CHECK (default_post_visibility IN ('public', 'followers', 'private'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_default_visibility 
ON public.profiles(default_post_visibility);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.default_post_visibility IS 
  'Default visibility for new posts: public (everyone), followers (followers only), or private (only me). Defaults to followers.';
