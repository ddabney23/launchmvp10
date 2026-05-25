-- ============================================
-- VENDOR VERIFICATION REQUIREMENTS
-- ============================================
-- This migration adds vendor verification requirements:
-- - Minimum 100 followers
-- - Minimum 5 completed sales (for re-verification)
-- - All documents uploaded
-- ============================================

-- Function to check if user meets vendor verification requirements
CREATE OR REPLACE FUNCTION public.check_vendor_requirements(user_uuid UUID)
RETURNS TABLE(
  meets_requirements BOOLEAN,
  follower_count INTEGER,
  total_sales INTEGER,
  missing_requirements TEXT[]
) AS $$
DECLARE
  user_followers INTEGER;
  user_sales INTEGER;
  missing TEXT[] := '{}';
  meets_reqs BOOLEAN := true;
BEGIN
  -- Get follower count
  SELECT p.follower_count INTO user_followers
  FROM public.profiles p
  WHERE p.id = user_uuid;
  
  -- Get sales count (if vendor profile exists)
  SELECT COALESCE(vp.total_sales, 0) INTO user_sales
  FROM public.vendor_profiles vp
  WHERE vp.id = user_uuid;
  
  -- Check minimum followers (100)
  IF user_followers < 100 THEN
    meets_reqs := false;
    missing := array_append(missing, 'Need ' || (100 - user_followers) || ' more followers');
  END IF;
  
  -- Check minimum sales (5) - only for existing vendors
  IF user_sales > 0 AND user_sales < 5 THEN
    meets_reqs := false;
    missing := array_append(missing, 'Need ' || (5 - user_sales) || ' more sales');
  END IF;
  
  -- Return results
  RETURN QUERY SELECT 
    meets_reqs,
    user_followers,
    user_sales,
    missing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check vendor badge eligibility
CREATE OR REPLACE FUNCTION public.check_vendor_badges(vendor_uuid UUID)
RETURNS VOID AS $$
DECLARE
  vendor_sales INTEGER;
  vendor_rating NUMERIC;
  badge_id_val UUID;
BEGIN
  -- Get vendor stats
  SELECT total_sales, rating
  INTO vendor_sales, vendor_rating
  FROM public.vendor_profiles
  WHERE id = vendor_uuid;
  
  -- Check "5-Star Seller" badge (10 five-star reviews)
  IF vendor_sales >= 10 AND vendor_rating >= 4.9 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'five_star_seller' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (vendor_uuid, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Create notification
      INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
      VALUES (
        vendor_uuid,
        'badge_earned',
        'Badge Unlocked!',
        'Congratulations! You''ve earned the 5-Star Seller badge!',
        jsonb_build_object('badge_key', 'five_star_seller'),
        NOW()
      );
    END IF;
  END IF;
  
  -- Check "Trusted Vendor" badge (50 sales)
  IF vendor_sales >= 50 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'trusted_vendor' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (vendor_uuid, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Create notification
      INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
      VALUES (
        vendor_uuid,
        'badge_earned',
        'Badge Unlocked!',
        'Congratulations! You''ve earned the Trusted Vendor badge!',
        jsonb_build_object('badge_key', 'trusted_vendor'),
        NOW()
      );
    END IF;
  END IF;
  
  -- Check "Community Favorite" badge (rating >= 4.8)
  IF vendor_sales >= 20 AND vendor_rating >= 4.8 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'community_favorite' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (vendor_uuid, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Create notification
      INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
      VALUES (
        vendor_uuid,
        'badge_earned',
        'Badge Unlocked!',
        'Congratulations! You''ve earned the Community Favorite badge!',
        jsonb_build_object('badge_key', 'community_favorite'),
        NOW()
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check vendor badges when sales/rating changes
CREATE OR REPLACE FUNCTION public.handle_vendor_stats_updated()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.check_vendor_badges(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendor_stats_updated ON public.vendor_profiles;
CREATE TRIGGER vendor_stats_updated
  AFTER UPDATE OF total_sales, rating ON public.vendor_profiles
  FOR EACH ROW
  WHEN (OLD.total_sales != NEW.total_sales OR OLD.rating != NEW.rating)
  EXECUTE FUNCTION public.handle_vendor_stats_updated();

COMMENT ON FUNCTION public.check_vendor_requirements IS 'Checks if user meets minimum requirements for vendor verification (100 followers, 5 sales)';
COMMENT ON FUNCTION public.check_vendor_badges IS 'Awards vendor badges based on sales and rating milestones';
