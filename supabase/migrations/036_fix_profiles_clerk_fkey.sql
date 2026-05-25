-- Migration: Fix profiles table for Clerk authentication
-- Remove foreign key constraint to auth.users and make id a regular UUID primary key

-- Step 1: Drop the foreign key constraint on id if it exists
DO $$ 
BEGIN
    -- Drop foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%profiles%fkey' 
        AND table_name = 'profiles' 
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    END IF;
END $$;

-- Step 2: Ensure id column is UUID with default gen_random_uuid()
-- This allows new profiles to be created without needing to reference auth.users
ALTER TABLE public.profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 3: Ensure clerk_user_id column exists and is unique
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- Step 4: Make clerk_user_id NOT NULL for new records (allow NULL for migration)
-- We'll update this after all existing records have clerk_user_id populated

-- Step 5: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id 
ON public.profiles(clerk_user_id) 
WHERE clerk_user_id IS NOT NULL;

-- Step 6: Add email column if not exists (for Clerk users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 7: Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON public.profiles(email) 
WHERE email IS NOT NULL;

-- Step 8: Add onboarding_completed column if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Step 9: Add comment for documentation
COMMENT ON COLUMN public.profiles.clerk_user_id IS 
  'Clerk authentication user ID (e.g., user_2abc123). Primary identifier for Clerk-authenticated users.';

COMMENT ON COLUMN public.profiles.id IS 
  'UUID primary key for internal references. Auto-generated, not tied to auth.users.';

COMMENT ON TABLE public.profiles IS 
  'User profiles for Clerk-authenticated users. id is auto-generated UUID, clerk_user_id is the Clerk user identifier.';
