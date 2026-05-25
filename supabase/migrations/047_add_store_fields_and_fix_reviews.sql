-- Migration: Add store fields to profiles and fix reviews table for vendor reviews
-- This migration adds store management fields to profiles and updates reviews to support vendor reviews

-- Add store fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS store_description TEXT,
ADD COLUMN IF NOT EXISTS store_banner_url TEXT,
ADD COLUMN IF NOT EXISTS store_policies JSONB,
ADD COLUMN IF NOT EXISTS store_hours JSONB,
ADD COLUMN IF NOT EXISTS store_location TEXT,
ADD COLUMN IF NOT EXISTS store_social_links JSONB;

-- Add vendor_id column to reviews table if it doesn't exist
-- This allows reviews to be linked directly to vendors (profiles) in addition to store_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reviews' 
    AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.reviews
    ADD COLUMN vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add reviewer_id column to reviews table if it doesn't exist (alternative to buyer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reviews' 
    AND column_name = 'reviewer_id'
  ) THEN
    ALTER TABLE public.reviews
    ADD COLUMN reviewer_id UUID;
    
    -- Add foreign key constraint with explicit name
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey 
    FOREIGN KEY (reviewer_id) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add comment column to reviews if it doesn't exist (alternative to body)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reviews' 
    AND column_name = 'comment'
  ) THEN
    ALTER TABLE public.reviews
    ADD COLUMN comment TEXT;
  END IF;
END $$;

-- Add rating column if it doesn't exist (ensure it's numeric, not integer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reviews' 
    AND column_name = 'rating'
  ) THEN
    ALTER TABLE public.reviews
    ADD COLUMN rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5);
  ELSE
    -- If rating exists as INTEGER, alter it to NUMERIC
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'reviews' 
      AND column_name = 'rating'
      AND data_type = 'integer'
    ) THEN
      ALTER TABLE public.reviews
      ALTER COLUMN rating TYPE NUMERIC(3,2);
    END IF;
  END IF;
END $$;

-- Add stripe_connect_account_id to vendor_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendor_profiles' 
    AND column_name = 'stripe_connect_account_id'
  ) THEN
    ALTER TABLE public.vendor_profiles
    ADD COLUMN stripe_connect_account_id TEXT;
  END IF;
END $$;

-- Create index on vendor_id for reviews if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_id ON public.reviews(vendor_id);

-- Create index on reviewer_id for reviews if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);

-- Create index on store fields for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_store_name ON public.profiles(store_name) WHERE store_name IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.store_name IS 'Store name for vendor storefront';
COMMENT ON COLUMN public.profiles.store_description IS 'Store description for vendor storefront';
COMMENT ON COLUMN public.profiles.store_banner_url IS 'Store banner image URL';
COMMENT ON COLUMN public.profiles.store_policies IS 'Store policies (return, shipping, refund) as JSON';
COMMENT ON COLUMN public.profiles.store_hours IS 'Store operating hours as JSON';
COMMENT ON COLUMN public.profiles.store_location IS 'Store location (city, state, country)';
COMMENT ON COLUMN public.profiles.store_social_links IS 'Social media links as JSON';
COMMENT ON COLUMN public.reviews.vendor_id IS 'Vendor profile ID (for vendor reviews)';
COMMENT ON COLUMN public.reviews.reviewer_id IS 'Reviewer profile ID';
COMMENT ON COLUMN public.reviews.comment IS 'Review comment text';
COMMENT ON COLUMN public.vendor_profiles.stripe_connect_account_id IS 'Stripe Connect account ID for vendor payouts';

-- Create storage bucket for store banners if it doesn't exist
-- Note: Since we're using Clerk, RLS policies are handled by the API route
-- The bucket just needs to exist and be public for read access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-banners',
  'store-banners',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Set up basic RLS policies for store-banners bucket
-- Public read access (banners are public)
CREATE POLICY IF NOT EXISTS "Public can view store banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'store-banners');

-- Note: Upload/update/delete permissions are handled by the /api/upload route
-- which validates Clerk authentication server-side

