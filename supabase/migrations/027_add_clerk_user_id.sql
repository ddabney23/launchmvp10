-- Migration: Add clerk_user_id column to profiles table
-- This allows storing Clerk user IDs (which are strings like "user_xxx") 
-- separately from the UUID primary key, enabling proper lookups

-- Step 1: Add clerk_user_id column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- Step 2: Create index for fast lookups by Clerk user ID
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id 
ON public.profiles(clerk_user_id) 
WHERE clerk_user_id IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN public.profiles.clerk_user_id IS 'Clerk authentication user ID (e.g., user_xxx). Used for lookups when authenticating with Clerk.';

