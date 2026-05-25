-- Migration: Fix Function Search Path Security Issues
-- Addresses Supabase security advisor warnings
-- Sets search_path = '' for all SECURITY DEFINER functions to prevent search_path attacks
-- Date: 2025-01

-- ============================================
-- Fix Search Path for All Functions
-- ============================================
-- Setting search_path = '' prevents search_path injection attacks
-- This is a security best practice for SECURITY DEFINER functions

-- Update vendor applications trigger function
CREATE OR REPLACE FUNCTION public.update_vendor_applications_updated_at()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update profile badges trigger function
CREATE OR REPLACE FUNCTION public.update_profile_badges_updated_at()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update is_admin_user function
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  user_email TEXT;
  user_is_admin BOOLEAN;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;
  
  -- Check if email matches admin pattern
  IF user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check for admin email pattern (legacy support)
  IF user_email LIKE '%@admin%' OR user_email LIKE '%admin@%' OR LOWER(user_email) = 'ddabney23@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  -- Check if profile has is_admin flag set to true
  SELECT is_admin INTO user_is_admin
  FROM public.profiles
  WHERE id = user_uuid;
  
  IF user_is_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Update sync_profile_email function
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update profile email when auth.users email changes
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Update sync_profile_email_on_insert function
CREATE OR REPLACE FUNCTION public.sync_profile_email_on_insert()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update profile email when new user is created
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Update generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update calculate_level function
CREATE OR REPLACE FUNCTION public.calculate_level(points INTEGER)
RETURNS INTEGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Level calculation: 100 points per level
  RETURN GREATEST(1, FLOOR(points / 100.0)::INTEGER);
END;
$$;

-- Update follower count functions
CREATE OR REPLACE FUNCTION public.increment_follower_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET followers_count = followers_count + 1
  WHERE id = NEW.following;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_follower_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET followers_count = GREATEST(0, followers_count - 1)
  WHERE id = OLD.following;
  RETURN OLD;
END;
$$;

-- Update following count functions
CREATE OR REPLACE FUNCTION public.increment_following_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET following_count = following_count + 1
  WHERE id = NEW.follower;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_following_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET following_count = GREATEST(0, following_count - 1)
  WHERE id = OLD.follower;
  RETURN OLD;
END;
$$;

-- Update post count function
CREATE OR REPLACE FUNCTION public.increment_post_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET posts_count = posts_count + 1
  WHERE id = NEW.author;
  RETURN NEW;
END;
$$;

-- Update comment count function
CREATE OR REPLACE FUNCTION public.increment_comment_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET comments_count = comments_count + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Update likes received function
CREATE OR REPLACE FUNCTION public.increment_likes_received()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET likes_received = likes_received + 1
  WHERE id = (
    SELECT author FROM public.posts WHERE id = NEW.post_id
  );
  RETURN NEW;
END;
$$;

-- Update purchase count function
CREATE OR REPLACE FUNCTION public.increment_purchase_count()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET purchase_count = purchase_count + 1
  WHERE id = NEW.buyer;
  RETURN NEW;
END;
$$;

-- Update award_points function
CREATE OR REPLACE FUNCTION public.award_points(
  user_id_param UUID,
  points_amount INTEGER,
  event_type TEXT,
  metadata_param JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  new_points INTEGER;
  new_level INTEGER;
BEGIN
  -- Update points
  UPDATE public.profiles
  SET points = points + points_amount
  WHERE id = user_id_param
  RETURNING points INTO new_points;
  
  -- Calculate and update level
  new_level := public.calculate_level(new_points);
  UPDATE public.profiles
  SET level = new_level
  WHERE id = user_id_param;
  
  -- Insert into points history
  INSERT INTO public.points_history (user_id, points, event_type, metadata)
  VALUES (user_id_param, points_amount, event_type, metadata_param);
END;
$$;

-- Update check_milestone_badges function
CREATE OR REPLACE FUNCTION public.check_milestone_badges(user_id_param UUID)
RETURNS VOID
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  user_points INTEGER;
  user_level INTEGER;
  milestone_badge_id UUID;
BEGIN
  -- Get user's current points and level
  SELECT points, level INTO user_points, user_level
  FROM public.profiles
  WHERE id = user_id_param;
  
  -- Check for milestone badges (example: level 5, 10, 20, etc.)
  -- This is a simplified version - adjust based on your badge system
  IF user_level >= 5 AND user_level < 10 THEN
    -- Award level 5 badge if exists
    SELECT id INTO milestone_badge_id
    FROM public.badges
    WHERE key = 'level_5'
    LIMIT 1;
    
    IF milestone_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (user_id_param, milestone_badge_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Add more milestone checks as needed
END;
$$;

-- Update handle_post_created_enhanced function
CREATE OR REPLACE FUNCTION public.handle_post_created_enhanced()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment post count
  PERFORM public.increment_post_count();
  
  -- Award points for creating post
  PERFORM public.award_points(
    NEW.author,
    5, -- 5 points for creating a post
    'post_created',
    jsonb_build_object('post_id', NEW.id)
  );
  
  -- Check for milestone badges
  PERFORM public.check_milestone_badges(NEW.author);
  
  RETURN NEW;
END;
$$;

-- Update handle_comment_created function
CREATE OR REPLACE FUNCTION public.handle_comment_created()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment comment count
  PERFORM public.increment_comment_count();
  
  -- Award points for commenting
  PERFORM public.award_points(
    NEW.user_id,
    2, -- 2 points for commenting
    'comment_created',
    jsonb_build_object('comment_id', NEW.id, 'post_id', NEW.post_id)
  );
  
  RETURN NEW;
END;
$$;

-- Update handle_like_created function
CREATE OR REPLACE FUNCTION public.handle_like_created()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment likes received for post author
  PERFORM public.increment_likes_received();
  
  -- Award points to post author for receiving like
  PERFORM public.award_points(
    (SELECT author FROM public.posts WHERE id = NEW.post_id),
    1, -- 1 point for receiving a like
    'like_received',
    jsonb_build_object('like_id', NEW.id, 'post_id', NEW.post_id)
  );
  
  RETURN NEW;
END;
$$;

-- Update handle_follow_created function
CREATE OR REPLACE FUNCTION public.handle_follow_created()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment follower/following counts
  PERFORM public.increment_follower_count();
  PERFORM public.increment_following_count();
  
  RETURN NEW;
END;
$$;

-- Update handle_follow_deleted function
CREATE OR REPLACE FUNCTION public.handle_follow_deleted()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Decrement follower/following counts
  PERFORM public.decrement_follower_count();
  PERFORM public.decrement_following_count();
  
  RETURN OLD;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.update_vendor_applications_updated_at() IS 
'Security fix: search_path set to empty string to prevent injection attacks';

COMMENT ON FUNCTION public.is_admin_user(UUID) IS 
'Security fix: search_path set to empty string to prevent injection attacks';

COMMENT ON FUNCTION public.award_points(UUID, INTEGER, TEXT, JSONB) IS 
'Security fix: search_path set to empty string to prevent injection attacks';

