-- Create ads table for admin-managed placements
CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cta_text TEXT,
  cta_url TEXT,
  placements TEXT[] DEFAULT ARRAY['feed'],
  is_active BOOLEAN DEFAULT TRUE,
  start_at TIMESTAMPTZ DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON public.ads(is_active);
CREATE INDEX IF NOT EXISTS idx_ads_placements ON public.ads USING GIN(placements);

-- Enable RLS
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active ads
DROP POLICY IF EXISTS "Ads are publicly readable" ON public.ads;
CREATE POLICY "Ads are publicly readable"
  ON public.ads
  FOR SELECT
  USING (true);

-- Allow admins to manage ads via admin client (handled server-side)
DROP POLICY IF EXISTS "Admins can insert ads" ON public.ads;
CREATE POLICY "Admins can insert ads"
  ON public.ads
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update ads" ON public.ads;
CREATE POLICY "Admins can update ads"
  ON public.ads
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete ads" ON public.ads;
CREATE POLICY "Admins can delete ads"
  ON public.ads
  FOR DELETE
  USING (true);

