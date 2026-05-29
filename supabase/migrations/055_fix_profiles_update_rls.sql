-- Fix profiles UPDATE policy broken in 051 (used clerk_id instead of id).
-- Supabase Auth: profiles.id = auth.users.id = auth.uid()

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "Users can update own profile" ON public.profiles IS
  'Allows users to update their own profile (id matches auth.uid())';
