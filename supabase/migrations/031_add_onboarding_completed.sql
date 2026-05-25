-- Add onboarding_completed field to profiles table
-- This tracks whether a user has completed the initial onboarding flow

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Set existing users with username/display_name as having completed onboarding
UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE (username IS NOT NULL AND username != '') 
   OR (display_name IS NOT NULL AND display_name != '');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON public.profiles(onboarding_completed);

-- Add helpful comment
COMMENT ON COLUMN public.profiles.onboarding_completed IS 
'Tracks whether user has completed initial onboarding flow. Set to TRUE when onboarding is finished.';
