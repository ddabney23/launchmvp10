-- Gamification: Points and badges system

-- Function to award points and check for badge eligibility
CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param UUID,
  points_amount INTEGER,
  event_type TEXT
)
RETURNS VOID AS $$
DECLARE
  new_total_points INTEGER;
  badge_record RECORD;
BEGIN
  -- Update user's points
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

-- Trigger function to award points for post creation
CREATE OR REPLACE FUNCTION public.handle_post_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_points(NEW.author, 5, 'post_created');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_created_points
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_created();

-- Trigger function to award points for receiving likes
CREATE OR REPLACE FUNCTION public.handle_post_liked()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  -- Get post author
  SELECT author INTO post_author
  FROM public.posts
  WHERE id = NEW.target_id AND NEW.target_type = 'post';

  IF post_author IS NOT NULL AND post_author != NEW.author THEN
    PERFORM public.award_points(post_author, 1, 'post_liked');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_liked_points
  AFTER INSERT ON public.likes
  FOR EACH ROW
  WHEN (NEW.target_type = 'post')
  EXECUTE FUNCTION public.handle_post_liked();

-- Trigger function to award points for listing creation
CREATE OR REPLACE FUNCTION public.handle_listing_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_points(NEW.vendor, 10, 'listing_created');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_created_points
  AFTER INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_listing_created();

-- Trigger function to award points for first sale
CREATE OR REPLACE FUNCTION public.handle_first_sale()
RETURNS TRIGGER AS $$
DECLARE
  sale_count INTEGER;
BEGIN
  -- Check if this is the vendor's first completed order
  SELECT COUNT(*) INTO sale_count
  FROM public.orders
  WHERE vendor = NEW.vendor
    AND status = 'completed'
    AND id != NEW.id;

  -- If first sale (count is 0 before this insert), award points
  IF sale_count = 0 AND NEW.status = 'completed' THEN
    PERFORM public.award_points(NEW.vendor, 25, 'first_sale');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER first_sale_points
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.handle_first_sale();

-- Function to create default badges (call this after badges table is created)
CREATE OR REPLACE FUNCTION public.seed_default_badges()
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.badges (key, name, description, icon) VALUES
    ('member', 'Member', 'Earned 50 points', '👤'),
    ('contributor', 'Contributor', 'Earned 100 points', '⭐'),
    ('active', 'Active Member', 'Earned 250 points', '🔥'),
    ('dedicated', 'Dedicated', 'Earned 500 points', '💎'),
    ('power_user', 'Power User', 'Earned 1000 points', '👑'),
    ('vendor', 'Vendor', 'Verified vendor account', '🏪'),
    ('first_sale', 'First Sale', 'Completed your first sale', '🎉')
  ON CONFLICT (key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Call seed function
SELECT public.seed_default_badges();

