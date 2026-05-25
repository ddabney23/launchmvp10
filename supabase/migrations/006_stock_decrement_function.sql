-- Function to safely decrement stock
CREATE OR REPLACE FUNCTION public.decrement_stock(listing_id UUID, quantity INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.listings
  SET stock = GREATEST(0, stock - quantity),
      updated_at = NOW()
  WHERE id = listing_id
    AND stock >= quantity;
  
  RETURN FOUND;
END;
$$;

