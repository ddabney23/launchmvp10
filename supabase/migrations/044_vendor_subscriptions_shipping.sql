-- Migration: Vendor Subscriptions, Stripe Connect, and Shippo Integration
-- This migration adds subscription management, shipping labels, and updates vendor profiles/orders

-- Vendor Subscriptions table
CREATE TABLE IF NOT EXISTS public.vendor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT, -- Stripe Price ID for the tier
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'pro', 'premium')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id) -- One active subscription per vendor
);

-- Shipping Labels table
CREATE TABLE IF NOT EXISTS public.shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  shippo_transaction_id TEXT UNIQUE,
  tracking_number TEXT,
  carrier TEXT, -- 'usps', 'fedex', 'ups', etc.
  service_level TEXT, -- 'priority', 'ground', etc.
  label_url TEXT,
  tracking_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'purchased', 'printed', 'shipped', 'delivered', 'error')),
  cost NUMERIC(10,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add subscription fields to vendor_profiles (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_profiles') THEN
    ALTER TABLE public.vendor_profiles 
    ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'premium')),
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS listing_limit INTEGER DEFAULT 5, -- Based on tier
    ADD COLUMN IF NOT EXISTS transaction_fee_percent NUMERIC(4,2) DEFAULT 2.00; -- Based on tier
  END IF;
END $$;

-- Add shipping fields to orders (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS shipping_address JSONB,
    ADD COLUMN IF NOT EXISTS shipping_method TEXT,
    ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS shippo_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS label_url TEXT;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_vendor_id ON public.vendor_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_stripe_subscription_id ON public.vendor_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_status ON public.vendor_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_tier ON public.vendor_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON public.shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_vendor_id ON public.shipping_labels(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number ON public.shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON public.shipping_labels(status);

-- Function to update updated_at timestamp for new tables
CREATE TRIGGER trigger_update_vendor_subscriptions_updated_at
  BEFORE UPDATE ON public.vendor_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_shipping_labels_updated_at
  BEFORE UPDATE ON public.shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to sync subscription tier to vendor_profiles
-- NOTE: This function and trigger will be created in a separate migration (045)
-- after vendor_profiles table is confirmed to exist. This avoids column validation
-- errors during migration 044.
-- 
-- The sync will be handled by the application code in the meantime, or you can
-- manually create the function and trigger after running this migration.

-- RLS Policies for vendor_subscriptions
ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own subscription
CREATE POLICY "vendors_view_own_subscription" ON public.vendor_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = vendor_subscriptions.vendor_id
      AND profiles.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Admins can view all subscriptions
CREATE POLICY "admins_view_all_subscriptions" ON public.vendor_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.clerk_user_id = auth.jwt() ->> 'sub'
      AND profiles.is_admin = TRUE
    )
  );

-- RLS Policies for shipping_labels
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own shipping labels
CREATE POLICY "vendors_view_own_shipping_labels" ON public.shipping_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = shipping_labels.vendor_id
      AND profiles.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Buyers can view shipping labels for their orders
CREATE POLICY "buyers_view_order_shipping_labels" ON public.shipping_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = shipping_labels.order_id
      AND orders.buyer IN (
        SELECT id FROM public.profiles
        WHERE profiles.clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Admins can view all shipping labels
CREATE POLICY "admins_view_all_shipping_labels" ON public.shipping_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.clerk_user_id = auth.jwt() ->> 'sub'
      AND profiles.is_admin = TRUE
    )
  );

