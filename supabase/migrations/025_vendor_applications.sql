-- Create vendor_applications table for vendor verification workflow
-- This table stores vendor applications submitted during onboarding

CREATE TABLE IF NOT EXISTS public.vendor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  tax_id TEXT,
  business_address JSONB DEFAULT '{}'::jsonb,
  phone_number TEXT,
  id_document_url TEXT,
  business_license_url TEXT,
  additional_documents JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  denial_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_applications_user_id ON public.vendor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_status ON public.vendor_applications(status);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_submitted_at ON public.vendor_applications(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: These policies use auth.uid() which won't work with Clerk
-- They're kept for reference but will need to be updated or disabled
-- For now, we use the admin client which bypasses RLS

-- Users can view their own applications (disabled for Clerk - use admin client)
-- CREATE POLICY "Users can view their own vendor applications"
--   ON public.vendor_applications
--   FOR SELECT
--   USING (auth.uid()::text = user_id::text);

-- Users can create their own applications (disabled for Clerk - use admin client)
-- CREATE POLICY "Users can create their own vendor applications"
--   ON public.vendor_applications
--   FOR INSERT
--   WITH CHECK (auth.uid()::text = user_id::text);

-- Admins can view all applications (disabled for Clerk - use admin client)
-- CREATE POLICY "Admins can view all vendor applications"
--   ON public.vendor_applications
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid()::uuid
--       AND is_admin = true
--     )
--   );

-- Admins can update applications (disabled for Clerk - use admin client)
-- CREATE POLICY "Admins can update vendor applications"
--   ON public.vendor_applications
--   FOR UPDATE
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid()::uuid
--       AND is_admin = true
--     )
--   );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_vendor_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendor_applications_updated_at
  BEFORE UPDATE ON public.vendor_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_applications_updated_at();

