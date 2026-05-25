-- Migration: Admin Listing Policies
-- Allows admins to fully manage all listings (CRUD operations)
-- This enables admins to moderate marketplace content

-- Step 1: Add admin policy for SELECT (view all listings, including inactive)
CREATE POLICY IF NOT EXISTS "admins_select_all_listings" ON public.listings
  FOR SELECT
  USING (
    -- Check if user is admin
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
    -- Admin function check as fallback
    OR public.is_admin_user(auth.uid())
  );

-- Step 2: Add admin policy for INSERT (create listings for any vendor)
CREATE POLICY IF NOT EXISTS "admins_insert_listings" ON public.listings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
    OR public.is_admin_user(auth.uid())
  );

-- Step 3: Add admin policy for UPDATE (edit any listing)
CREATE POLICY IF NOT EXISTS "admins_update_all_listings" ON public.listings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
    OR public.is_admin_user(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
    OR public.is_admin_user(auth.uid())
  );

-- Step 4: Add admin policy for DELETE (delete any listing)
CREATE POLICY IF NOT EXISTS "admins_delete_all_listings" ON public.listings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
    OR public.is_admin_user(auth.uid())
  );

-- Step 5: Add comments for documentation
COMMENT ON POLICY "admins_select_all_listings" ON public.listings IS 'Allows admins to view all listings including inactive ones';
COMMENT ON POLICY "admins_insert_listings" ON public.listings IS 'Allows admins to create listings for any vendor';
COMMENT ON POLICY "admins_update_all_listings" ON public.listings IS 'Allows admins to edit any listing';
COMMENT ON POLICY "admins_delete_all_listings" ON public.listings IS 'Allows admins to delete any listing';

-- Step 6: Verify policies
-- Run this query to see all policies on listings table:
-- SELECT * FROM pg_policies WHERE tablename = 'listings';

