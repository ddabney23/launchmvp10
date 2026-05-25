-- Coupons table for vendor promotions
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_purchase NUMERIC(10,2),
  max_discount NUMERIC(10,2),
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_vendor_id ON public.coupons(vendor_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(active) WHERE active = TRUE;

-- RLS Policies
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own coupons
CREATE POLICY "Vendors can view their own coupons"
  ON public.coupons
  FOR SELECT
  USING (auth.uid() = vendor_id);

-- Vendors can insert their own coupons
CREATE POLICY "Vendors can create their own coupons"
  ON public.coupons
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

-- Vendors can update their own coupons
CREATE POLICY "Vendors can update their own coupons"
  ON public.coupons
  FOR UPDATE
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

-- Vendors can delete their own coupons
CREATE POLICY "Vendors can delete their own coupons"
  ON public.coupons
  FOR DELETE
  USING (auth.uid() = vendor_id);

-- Public can view active coupons (for validation during checkout)
CREATE POLICY "Public can view active coupons"
  ON public.coupons
  FOR SELECT
  USING (active = TRUE);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_coupons_updated_at();

