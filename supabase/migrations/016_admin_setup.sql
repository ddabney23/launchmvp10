-- Migration: Admin Setup
-- Adds email column and is_admin column to profiles table, then sets initial admin user
-- Created: 2024

-- Step 1: Add email column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Populate email column from auth.users for existing profiles
-- This syncs email from auth.users to profiles for existing users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
AND p.email IS NULL;

-- Step 3: Add is_admin column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Step 4: Create index for admin queries (for performance)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- Step 5: Create index for email lookups (for performance)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- Step 6: Set initial admin user by email
-- This will work by joining with auth.users to find the user ID
UPDATE public.profiles 
SET is_admin = true 
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'ddabney23@gmail.com'
);

-- Step 7: Also ensure email is set for the admin user
UPDATE public.profiles 
SET email = 'ddabney23@gmail.com'
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email = 'ddabney23@gmail.com'
)
AND (email IS NULL OR email != 'ddabney23@gmail.com');

-- Step 8: Update the is_admin_user function to properly check the is_admin column
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  user_is_admin BOOLEAN;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;
  
  -- Check if email matches admin pattern
  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check for admin email pattern (legacy support)
  IF user_email LIKE '%@admin%' OR user_email LIKE '%admin@%' OR LOWER(user_email) = 'ddabney23@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if profile has is_admin flag set to true
  SELECT is_admin INTO user_is_admin
  FROM public.profiles
  WHERE id = user_uuid;
  
  IF user_is_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Add comment to columns for documentation
COMMENT ON COLUMN public.profiles.email IS 'User email address (synced from auth.users)';
COMMENT ON COLUMN public.profiles.is_admin IS 'Flag indicating if user has admin privileges';

-- Step 10: Create a trigger to automatically sync email from auth.users to profiles
-- This ensures email stays in sync when users update their email in auth
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email when auth.users email changes
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON auth.users;
CREATE TRIGGER sync_profile_email_trigger
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

-- Also sync on insert (when new user is created)
CREATE OR REPLACE FUNCTION public.sync_profile_email_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email when new user is created
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_profile_email_insert_trigger ON auth.users;
CREATE TRIGGER sync_profile_email_insert_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_on_insert();

