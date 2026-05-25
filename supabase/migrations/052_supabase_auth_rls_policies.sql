-- Migration: RLS policies for Supabase Auth (auth.uid()) instead of Clerk JWT sub
-- Fresh Supabase Auth: profiles.id = auth.users.id

-- vendor_subscriptions
DROP POLICY IF EXISTS "vendors_view_own_subscription" ON public.vendor_subscriptions;
CREATE POLICY "vendors_view_own_subscription" ON public.vendor_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = vendor_subscriptions.vendor_id
      AND profiles.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admins_view_all_subscriptions" ON public.vendor_subscriptions;
CREATE POLICY "admins_view_all_subscriptions" ON public.vendor_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- shipping_labels
DROP POLICY IF EXISTS "vendors_view_own_shipping_labels" ON public.shipping_labels;
CREATE POLICY "vendors_view_own_shipping_labels" ON public.shipping_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = shipping_labels.vendor_id
      AND profiles.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "buyers_view_order_shipping_labels" ON public.shipping_labels;
CREATE POLICY "buyers_view_order_shipping_labels" ON public.shipping_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = shipping_labels.order_id
      AND orders.buyer IN (
        SELECT id FROM public.profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "admins_view_all_shipping_labels" ON public.shipping_labels;
CREATE POLICY "admins_view_all_shipping_labels" ON public.shipping_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );
