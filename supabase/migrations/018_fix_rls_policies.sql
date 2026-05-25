-- Migration: Fix RLS Policies for Profiles
-- This ensures authenticated users can access their own profiles even if email isn't confirmed
-- Fixes 403 permission denied errors

-- Drop ALL existing policies on profiles to avoid conflicts
DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate policies with proper handling
-- Allow public read access to profiles (for viewing other users)
CREATE POLICY "select_profiles" ON public.profiles
  FOR SELECT
  USING (true);

-- Allow users to update their own profile
-- auth.uid() works as long as user has a valid session (even if email not confirmed)
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Comment for documentation
COMMENT ON POLICY "select_profiles" ON public.profiles IS 'Allows public read access to profiles';
COMMENT ON POLICY "update_own_profile" ON public.profiles IS 'Allows users to update their own profile';
COMMENT ON POLICY "insert_own_profile" ON public.profiles IS 'Allows users to create their own profile';

