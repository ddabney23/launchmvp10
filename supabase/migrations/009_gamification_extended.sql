-- Extended Gamification Triggers
-- Extends existing gamification with order completion, group activity, and review points

-- Function to log points to user_points table
CREATE OR REPLACE FUNCTION public.log_points(
  user_id_param UUID,
  points_amount INTEGER,
  reason_param TEXT,
  metadata_param JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_points (user_id, points, reason, metadata)
  VALUES (user_id_param, points_amount, reason_param, metadata_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to award points and check for badge eligibility
-- This extends the existing award_points function to also log to user_points table
CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param UUID,
  points_amount INTEGER,
  event_type TEXT,
  metadata_param JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID AS $$
DECLARE
  new_total_points INTEGER;
  badge_record RECORD;
BEGIN
  -- Log points to user_points table
  PERFORM public.log_points(user_id_param, points_amount, event_type, metadata_param);
  
  -- Update user's total points
  UPDATE public.profiles
  SET points = points + points_amount
  WHERE id = user_id_param
  RETURNING points INTO new_total_points;

  -- Check for badge eligibility based on points thresholds
  FOR badge_record IN 
    SELECT id, key FROM public.badges 
    WHERE key IN (
      CASE 
        WHEN new_total_points >= 1000 THEN 'power_user'
        WHEN new_total_points >= 500 THEN 'dedicated'
        WHEN new_total_points >= 250 THEN 'active'
        WHEN new_total_points >= 100 THEN 'contributor'
        WHEN new_total_points >= 50 THEN 'member'
        ELSE NULL
      END
    )
  LOOP
    -- Award badge if not already awarded
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (user_id_param, badge_record.id)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to award points for order completion (buyer and vendor)
CREATE OR REPLACE FUNCTION public.handle_order_completed()
RETURNS TRIGGER AS $$
DECLARE
  order_metadata JSONB;
BEGIN
  -- Only trigger when status changes to 'paid' or 'completed'
  IF NEW.status IN ('paid', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('paid', 'completed')) THEN
    order_metadata := jsonb_build_object(
      'order_id', NEW.id,
      'total', NEW.total,
      'vendor_id', NEW.vendor
    );
    
    -- Award points to buyer
    IF NEW.buyer IS NOT NULL THEN
      PERFORM public.award_points(
        NEW.buyer,
        10,
        'order_completed',
        order_metadata
      );
    END IF;
    
    -- Award points to vendor
    IF NEW.vendor IS NOT NULL THEN
      PERFORM public.award_points(
        NEW.vendor,
        25,
        'sale_completed',
        order_metadata
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS order_completed_points ON public.orders;
CREATE TRIGGER order_completed_points
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IN ('paid', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('paid', 'completed')))
  EXECUTE FUNCTION public.handle_order_completed();

-- Trigger function to award points for creating a group
CREATE OR REPLACE FUNCTION public.handle_group_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner IS NOT NULL THEN
    PERFORM public.award_points(
      NEW.owner,
      15,
      'group_created',
      jsonb_build_object('group_id', NEW.id, 'group_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_created_points
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_group_created();

-- Trigger function to award points for writing a review
CREATE OR REPLACE FUNCTION public.handle_review_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.buyer IS NOT NULL THEN
    PERFORM public.award_points(
      NEW.buyer,
      5,
      'review_created',
      jsonb_build_object('review_id', NEW.id, 'store_id', NEW.store_id, 'rating', NEW.rating)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_created_points
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_review_created();

-- Trigger function to award points for joining a group (first time only)
CREATE OR REPLACE FUNCTION public.handle_group_joined()
RETURNS TRIGGER AS $$
DECLARE
  group_count INTEGER;
BEGIN
  -- Check if this is user's first group join
  SELECT COUNT(*) INTO group_count
  FROM public.group_members
  WHERE user_id = NEW.user_id
  AND id != NEW.id;
  
  -- Award points for first group join
  IF group_count = 0 THEN
    PERFORM public.award_points(
      NEW.user_id,
      5,
      'first_group_join',
      jsonb_build_object('group_id', NEW.group_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_joined_points
  AFTER INSERT ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_group_joined();

-- Function to award vendor verification badge
CREATE OR REPLACE FUNCTION public.award_vendor_badge()
RETURNS TRIGGER AS $$
DECLARE
  vendor_badge_id UUID;
BEGIN
  -- Only award badge when vendor_verified changes from false to true
  IF NEW.vendor_verified = TRUE AND (OLD.vendor_verified IS NULL OR OLD.vendor_verified = FALSE) THEN
    -- Find vendor badge
    SELECT id INTO vendor_badge_id
    FROM public.badges
    WHERE key = 'vendor'
    LIMIT 1;
    
    -- Award badge if found
    IF vendor_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.id, vendor_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendor_verified_badge
  AFTER UPDATE OF vendor_verified ON public.profiles
  FOR EACH ROW
  WHEN (NEW.vendor_verified = TRUE AND (OLD.vendor_verified IS NULL OR OLD.vendor_verified = FALSE))
  EXECUTE FUNCTION public.award_vendor_badge();

