-- Migration: Create subscription sync trigger function
-- This migration creates the trigger function to sync subscription tiers to vendor_profiles
-- It runs after migration 044 to ensure vendor_profiles table exists

-- Function to sync subscription tier to vendor_profiles
-- Check that both tables and columns exist before creating function
DO $$
BEGIN
  -- Only create function if vendor_subscriptions table exists and has vendor_id column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_subscriptions'
  ) AND EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_subscriptions' 
    AND column_name = 'vendor_id'
  ) THEN
    -- Create function using EXECUTE to avoid column validation at creation time
    EXECUTE format('
    CREATE OR REPLACE FUNCTION public.sync_subscription_tier()
    RETURNS TRIGGER AS $func$
    DECLARE
      v_vendor_id UUID;
      v_tier TEXT;
      v_status TEXT;
      v_row_json JSONB;
    BEGIN
      -- Convert NEW record to JSON to extract values safely
      v_row_json := row_to_json(NEW)::jsonb;
      
      -- Extract values from JSON
      v_vendor_id := (v_row_json->>%L)::UUID;
      v_tier := v_row_json->>%L;
      v_status := COALESCE(v_row_json->>%L, %L);
      
      -- Only update if vendor_profiles table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = %L AND table_name = %L) THEN
        UPDATE public.vendor_profiles
        SET 
          subscription_tier = v_tier,
          subscription_status = v_status,
          listing_limit = CASE 
            WHEN v_tier = %L THEN 5
            WHEN v_tier = %L THEN 30
            WHEN v_tier = %L THEN -1
            WHEN v_tier = %L THEN -1
            ELSE 5
          END,
          transaction_fee_percent = CASE
            WHEN v_tier = %L THEN 2.00
            WHEN v_tier = %L THEN 1.50
            WHEN v_tier = %L THEN 1.00
            WHEN v_tier = %L THEN 0.50
            ELSE 2.00
          END,
          updated_at = NOW()
        WHERE id = v_vendor_id;
      END IF;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    ', 
    'vendor_id', 'tier', 'status', 'active',  -- column names and default
    'public', 'vendor_profiles',  -- table schema and name
    'free', 'basic', 'pro', 'premium',  -- tier values for listing_limit
    'free', 'basic', 'pro', 'premium'   -- tier values for transaction_fee_percent
    );
  END IF;
END $$;

-- Create trigger only if vendor_profiles exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_profiles') THEN
    DROP TRIGGER IF EXISTS trigger_sync_subscription_tier ON public.vendor_subscriptions;
    CREATE TRIGGER trigger_sync_subscription_tier
      AFTER INSERT OR UPDATE ON public.vendor_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_subscription_tier();
  END IF;
END $$;

