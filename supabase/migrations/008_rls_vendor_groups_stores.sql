-- RLS Policies for Vendor Profiles, Groups, Store Profiles, Transactions, Payouts, Reviews

-- Enable RLS on new tables
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "vendor_profiles_select_public" ON public.vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_select_own" ON public.vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_insert_own" ON public.vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_update_own" ON public.vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_admin" ON public.vendor_profiles;

DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_owner" ON public.groups;

DROP POLICY IF EXISTS "group_members_select_public" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select_member" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_auth" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update_own" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete_own" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete_admin" ON public.group_members;

DROP POLICY IF EXISTS "store_profiles_select_public" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_insert_vendor" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_update_vendor" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_delete_vendor" ON public.store_profiles;

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_vendor" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_server" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_server" ON public.transactions;

DROP POLICY IF EXISTS "payouts_select_vendor" ON public.payouts;
DROP POLICY IF EXISTS "payouts_insert_server" ON public.payouts;
DROP POLICY IF EXISTS "payouts_update_server" ON public.payouts;

DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_buyer" ON public.reviews;
DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;

DROP POLICY IF EXISTS "user_points_select_own" ON public.user_points;
DROP POLICY IF EXISTS "user_points_insert_server" ON public.user_points;

-- Vendor Profiles Policies
-- Public can see basic vendor info (name, verified status)
CREATE POLICY "vendor_profiles_select_public" ON public.vendor_profiles
  FOR SELECT
  USING (true);

-- Vendors can see their own full profile
CREATE POLICY "vendor_profiles_select_own" ON public.vendor_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Vendors can insert their own profile
CREATE POLICY "vendor_profiles_insert_own" ON public.vendor_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Vendors can update their own profile
CREATE POLICY "vendor_profiles_update_own" ON public.vendor_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all (TODO: Replace with proper admin role check)
CREATE POLICY "vendor_profiles_admin" ON public.vendor_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (email LIKE '%@admin%' OR vendor_verified = true) -- Temporary admin check
    )
  );

-- Groups Policies
-- Public groups are visible to everyone
CREATE POLICY "groups_select_public" ON public.groups
  FOR SELECT
  USING (is_public = true);

-- Group members can see their groups even if private
CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id
      AND user_id = auth.uid()
    )
  );

-- Authenticated users can create groups
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner);

-- Group owners can update their groups
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE
  USING (auth.uid() = owner);

-- Group admins can update groups
CREATE POLICY "groups_update_admin" ON public.groups
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = groups.id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- Group owners can delete their groups
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE
  USING (auth.uid() = owner);

-- Group Members Policies
-- Public can see group members for public groups
CREATE POLICY "group_members_select_public" ON public.group_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_members.group_id
      AND is_public = true
    )
  );

-- Members can see other members of groups they're in
CREATE POLICY "group_members_select_member" ON public.group_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

-- Authenticated users can join groups (insert themselves)
CREATE POLICY "group_members_insert_auth" ON public.group_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own membership
CREATE POLICY "group_members_update_own" ON public.group_members
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can leave groups (delete their own membership)
CREATE POLICY "group_members_delete_own" ON public.group_members
  FOR DELETE
  USING (auth.uid() = user_id);

-- Group admins can remove members
CREATE POLICY "group_members_delete_admin" ON public.group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('admin', 'moderator')
    )
  );

-- Store Profiles Policies
-- Public can see all store profiles
CREATE POLICY "store_profiles_select_public" ON public.store_profiles
  FOR SELECT
  USING (true);

-- Vendors can create store profiles linked to their vendor profile
CREATE POLICY "store_profiles_insert_vendor" ON public.store_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE id = store_profiles.vendor_profile_id
      AND vendor_profiles.id = auth.uid()
    )
  );

-- Vendors can update their own store profiles
CREATE POLICY "store_profiles_update_vendor" ON public.store_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE id = store_profiles.vendor_profile_id
      AND vendor_profiles.id = auth.uid()
    )
  );

-- Vendors can delete their own store profiles
CREATE POLICY "store_profiles_delete_vendor" ON public.store_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles
      WHERE id = store_profiles.vendor_profile_id
      AND vendor_profiles.id = auth.uid()
    )
  );

-- Transactions Policies
-- Users can see their own transactions
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- Vendors can see transactions for their orders
CREATE POLICY "transactions_select_vendor" ON public.transactions
  FOR SELECT
  USING (vendor_id = auth.uid());

-- Only server (Edge Functions) can insert transactions
-- Client-side inserts will fail - transactions must go through Edge Functions
CREATE POLICY "transactions_insert_server" ON public.transactions
  FOR INSERT
  WITH CHECK (false); -- Blocked - use Edge Function

-- Only server can update transactions
CREATE POLICY "transactions_update_server" ON public.transactions
  FOR UPDATE
  USING (false); -- Blocked - use Edge Function

-- Payouts Policies
-- Vendors can see their own payouts
CREATE POLICY "payouts_select_vendor" ON public.payouts
  FOR SELECT
  USING (vendor_id = auth.uid());

-- Only server (Edge Functions) can insert payouts
CREATE POLICY "payouts_insert_server" ON public.payouts
  FOR INSERT
  WITH CHECK (false); -- Blocked - use Edge Function

-- Only server can update payouts
CREATE POLICY "payouts_update_server" ON public.payouts
  FOR UPDATE
  USING (false); -- Blocked - use Edge Function

-- Reviews Policies
-- Public can see all reviews
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT
  USING (true);

-- Buyers can create reviews for stores
CREATE POLICY "reviews_insert_buyer" ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid() = buyer);

-- Reviewers can update their own reviews
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE
  USING (auth.uid() = buyer);

-- Reviewers can delete their own reviews
CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE
  USING (auth.uid() = buyer);

-- User Points Policies
-- Users can see their own point history
CREATE POLICY "user_points_select_own" ON public.user_points
  FOR SELECT
  USING (user_id = auth.uid());

-- Only server (triggers/Edge Functions) can insert points
CREATE POLICY "user_points_insert_server" ON public.user_points
  FOR INSERT
  WITH CHECK (false); -- Blocked - use triggers/Edge Functions

