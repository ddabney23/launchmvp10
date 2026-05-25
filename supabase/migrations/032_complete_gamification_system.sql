-- ============================================
-- COMPLETE GAMIFICATION SYSTEM IMPLEMENTATION
-- ============================================
-- This migration adds:
-- 1. Profile level system (Bronze → Diamond)
-- 2. Profile stat counters (posts, comments, followers, etc.)
-- 3. Vendor stat counters (sales, orders, rating)
-- 4. Milestone badges
-- 5. RPC functions for auto-updates
-- 6. Enhanced triggers for real-time updates
-- ============================================

-- ============================================
-- PART 1: ADD PROFILE FIELDS
-- ============================================

-- Add level field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Bronze' 
CHECK (level IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'));

-- Add profile stat counters
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_posts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_comments INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_likes_received INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_purchases INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level);
CREATE INDEX IF NOT EXISTS idx_profiles_follower_count ON public.profiles(follower_count);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points);

-- ============================================
-- PART 2: ADD VENDOR PROFILE FIELDS
-- ============================================

-- Add vendor stat counters
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_listings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_rating ON public.vendor_profiles(rating);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_total_sales ON public.vendor_profiles(total_sales);

-- ============================================
-- PART 3: LEVEL CALCULATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_level(points_amount INTEGER)
RETURNS TEXT AS $$
BEGIN
  CASE 
    WHEN points_amount >= 1000 THEN RETURN 'Diamond';
    WHEN points_amount >= 500 THEN RETURN 'Platinum';
    WHEN points_amount >= 250 THEN RETURN 'Gold';
    WHEN points_amount >= 100 THEN RETURN 'Silver';
    ELSE RETURN 'Bronze';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- PART 4: RPC FUNCTIONS FOR STAT UPDATES
-- ============================================

-- Increment follower count
CREATE OR REPLACE FUNCTION public.increment_follower_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET follower_count = follower_count + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement follower count
CREATE OR REPLACE FUNCTION public.decrement_follower_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET follower_count = GREATEST(follower_count - 1, 0),
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment following count
CREATE OR REPLACE FUNCTION public.increment_following_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET following_count = following_count + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement following count
CREATE OR REPLACE FUNCTION public.decrement_following_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET following_count = GREATEST(following_count - 1, 0),
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment post count
CREATE OR REPLACE FUNCTION public.increment_post_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET total_posts = total_posts + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment comment count
CREATE OR REPLACE FUNCTION public.increment_comment_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET total_comments = total_comments + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment likes received count
CREATE OR REPLACE FUNCTION public.increment_likes_received(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET total_likes_received = total_likes_received + 1
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment purchase count
CREATE OR REPLACE FUNCTION public.increment_purchase_count(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET total_purchases = total_purchases + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment vendor sales
CREATE OR REPLACE FUNCTION public.increment_vendor_sales(vendor_uuid UUID, sale_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.vendor_profiles
  SET total_sales = total_sales + 1,
      total_orders = total_orders + 1,
      payout_balance = payout_balance + sale_amount
  WHERE id = vendor_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update vendor rating
CREATE OR REPLACE FUNCTION public.update_vendor_rating(vendor_uuid UUID, new_rating NUMERIC)
RETURNS VOID AS $$
DECLARE
  current_total_reviews INTEGER;
  current_rating NUMERIC;
  new_total_reviews INTEGER;
  calculated_rating NUMERIC;
BEGIN
  -- Get current stats
  SELECT total_reviews, rating INTO current_total_reviews, current_rating
  FROM public.vendor_profiles
  WHERE id = vendor_uuid;
  
  -- Calculate new weighted average
  new_total_reviews := current_total_reviews + 1;
  calculated_rating := ((current_rating * current_total_reviews) + new_rating) / new_total_reviews;
  
  -- Update vendor profile
  UPDATE public.vendor_profiles
  SET rating = calculated_rating,
      total_reviews = new_total_reviews
  WHERE id = vendor_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 5: ENHANCED AWARD POINTS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param UUID,
  points_amount INTEGER,
  event_type TEXT,
  metadata_param JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(new_points INTEGER, new_level TEXT, level_changed BOOLEAN) AS $$
DECLARE
  old_points INTEGER;
  old_level TEXT;
  new_points_val INTEGER;
  new_level_val TEXT;
  level_changed_val BOOLEAN := false;
BEGIN
  -- Get current points and level
  SELECT points, level INTO old_points, old_level
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- Calculate new points
  new_points_val := old_points + points_amount;
  
  -- Calculate new level
  new_level_val := public.calculate_level(new_points_val);
  
  -- Check if level changed
  IF new_level_val != old_level THEN
    level_changed_val := true;
  END IF;
  
  -- Update profile with new points and level
  UPDATE public.profiles
  SET points = new_points_val,
      level = new_level_val,
      updated_at = NOW()
  WHERE id = user_id_param;
  
  -- Record in user_points history
  INSERT INTO public.user_points (user_id, points, reason, metadata, awarded_at)
  VALUES (user_id_param, points_amount, event_type, metadata_param, NOW());
  
  -- If level changed, create notification
  IF level_changed_val THEN
    INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
    VALUES (
      user_id_param,
      'level_up',
      'Level Up!',
      'Congratulations! You''ve reached ' || new_level_val || ' level!',
      jsonb_build_object('new_level', new_level_val, 'old_level', old_level),
      NOW()
    );
  END IF;
  
  -- Create points earned notification
  INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
  VALUES (
    user_id_param,
    'points_earned',
    'Points Earned!',
    'You earned ' || points_amount || ' points for ' || event_type,
    jsonb_build_object('points', points_amount, 'reason', event_type, 'new_total', new_points_val),
    NOW()
  );
  
  -- Return results
  RETURN QUERY SELECT new_points_val, new_level_val, level_changed_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 6: MILESTONE BADGE CHECKING FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.check_milestone_badges(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
  user_posts INTEGER;
  user_comments INTEGER;
  user_followers INTEGER;
  badge_id_val UUID;
BEGIN
  -- Get user stats
  SELECT total_posts, total_comments, follower_count
  INTO user_posts, user_comments, user_followers
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- Check "First Post" badge (1 post)
  IF user_posts = 1 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'first_post' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (user_id_param, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Check "Social Butterfly" badge (10 posts)
  IF user_posts >= 10 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'social_butterfly' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (user_id_param, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Check "Influencer" badge (100 followers)
  IF user_followers >= 100 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'influencer' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (user_id_param, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
  
  -- Check "Top Commenter" badge (50 comments)
  IF user_comments >= 50 THEN
    SELECT id INTO badge_id_val FROM public.badges WHERE key = 'top_commenter' LIMIT 1;
    IF badge_id_val IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id, earned_at)
      VALUES (user_id_param, badge_id_val, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 7: ENHANCED TRIGGERS
-- ============================================

-- Update post count trigger
CREATE OR REPLACE FUNCTION public.handle_post_created_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment post count
  PERFORM public.increment_post_count(NEW.user_id);
  
  -- Award points
  PERFORM public.award_points(NEW.user_id, 5, 'post_created', jsonb_build_object('post_id', NEW.id));
  
  -- Check milestone badges
  PERFORM public.check_milestone_badges(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_created_enhanced ON public.posts;
CREATE TRIGGER post_created_enhanced
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_created_enhanced();

-- Update comment count and award points
CREATE OR REPLACE FUNCTION public.handle_comment_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment comment count
  PERFORM public.increment_comment_count(NEW.author);
  
  -- Award points
  PERFORM public.award_points(NEW.author, 2, 'comment_created', jsonb_build_object('post_id', NEW.post_id));
  
  -- Check milestone badges
  PERFORM public.check_milestone_badges(NEW.author);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_created_points ON public.comments;
CREATE TRIGGER comment_created_points
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_created();

-- Update likes received count
CREATE OR REPLACE FUNCTION public.handle_like_created()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  -- Get post author
  IF NEW.target_type = 'post' THEN
    SELECT user_id INTO post_author FROM public.posts WHERE id = NEW.target_id;
    
    IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
      -- Increment likes received
      PERFORM public.increment_likes_received(post_author);
      
      -- Award point to post author
      PERFORM public.award_points(post_author, 1, 'post_liked', jsonb_build_object('post_id', NEW.target_id));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS like_created_points ON public.post_likes;
CREATE TRIGGER like_created_points
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_created();

-- Update follower/following counts
CREATE OR REPLACE FUNCTION public.handle_follow_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment follower count for the followed user
  PERFORM public.increment_follower_count(NEW.following_id);
  
  -- Increment following count for the follower
  PERFORM public.increment_following_count(NEW.follower_id);
  
  -- Award points to both users
  PERFORM public.award_points(NEW.follower_id, 3, 'follow_given', jsonb_build_object('following_id', NEW.following_id));
  PERFORM public.award_points(NEW.following_id, 3, 'follow_received', jsonb_build_object('follower_id', NEW.follower_id));
  
  -- Check milestone badges for both users
  PERFORM public.check_milestone_badges(NEW.follower_id);
  PERFORM public.check_milestone_badges(NEW.following_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_follow_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement follower count
  PERFORM public.decrement_follower_count(OLD.following_id);
  
  -- Decrement following count
  PERFORM public.decrement_following_count(OLD.follower_id);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS follow_created ON public.follows;
CREATE TRIGGER follow_created
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_follow_created();

DROP TRIGGER IF EXISTS follow_deleted ON public.follows;
CREATE TRIGGER follow_deleted
  AFTER DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_follow_deleted();

-- ============================================
-- PART 8: INSERT MILESTONE BADGES
-- ============================================

-- Insert milestone badges (if they don't exist)
INSERT INTO public.badges (key, name, description, image_url, tier, created_at)
VALUES
  ('first_post', 'First Post', 'Created your first post', NULL, 'bronze', NOW()),
  ('social_butterfly', 'Social Butterfly', 'Created 10 posts', NULL, 'silver', NOW()),
  ('influencer', 'Influencer', 'Gained 100 followers', NULL, 'gold', NOW()),
  ('top_commenter', 'Top Commenter', 'Made 50 comments', NULL, 'silver', NOW()),
  ('five_star_seller', '5-Star Seller', 'Received 10 five-star reviews', NULL, 'gold', NOW()),
  ('trusted_vendor', 'Trusted Vendor', 'Completed 50 successful sales', NULL, 'platinum', NOW()),
  ('community_favorite', 'Community Favorite', 'Achieved 4.8+ average rating', NULL, 'diamond', NOW())
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ============================================
-- PART 9: BACKFILL EXISTING DATA
-- ============================================

-- Calculate and update post counts for existing users
UPDATE public.profiles p
SET total_posts = (
  SELECT COUNT(*) FROM public.posts WHERE user_id = p.id AND is_deleted = false
);

-- Calculate and update follower/following counts
UPDATE public.profiles p
SET follower_count = (
  SELECT COUNT(*) FROM public.follows WHERE following_id = p.id
),
following_count = (
  SELECT COUNT(*) FROM public.follows WHERE follower_id = p.id
);

-- Calculate and update levels based on current points
UPDATE public.profiles
SET level = public.calculate_level(points);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.profiles.level IS 'User level based on points: Bronze, Silver, Gold, Platinum, Diamond';
COMMENT ON COLUMN public.profiles.total_posts IS 'Total number of posts created by user';
COMMENT ON COLUMN public.profiles.total_comments IS 'Total number of comments made by user';
COMMENT ON COLUMN public.profiles.total_likes_received IS 'Total likes received on user posts';
COMMENT ON COLUMN public.profiles.total_purchases IS 'Total number of purchases made';
COMMENT ON COLUMN public.profiles.follower_count IS 'Number of users following this user';
COMMENT ON COLUMN public.profiles.following_count IS 'Number of users this user follows';

COMMENT ON COLUMN public.vendor_profiles.total_sales IS 'Total number of completed sales';
COMMENT ON COLUMN public.vendor_profiles.total_orders IS 'Total number of orders received';
COMMENT ON COLUMN public.vendor_profiles.rating IS 'Average vendor rating (0.00 - 5.00)';
COMMENT ON COLUMN public.vendor_profiles.total_reviews IS 'Total number of reviews received';
