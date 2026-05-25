-- Notification triggers for various events

-- Function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  user_id_param UUID,
  type_param TEXT,
  data_param JSONB
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, data)
  VALUES (user_id_param, type_param, data_param)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Notify user when their post is liked
CREATE OR REPLACE FUNCTION public.handle_post_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  -- Get post author
  SELECT author INTO post_author
  FROM public.posts
  WHERE id = NEW.target_id AND NEW.target_type = 'post';

  -- Create notification if not own like
  IF post_author IS NOT NULL AND post_author != NEW.author THEN
    PERFORM public.create_notification(
      post_author,
      'post_liked',
      jsonb_build_object(
        'post_id', NEW.target_id,
        'liked_by', NEW.author,
        'like_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_like_notification
  AFTER INSERT ON public.likes
  FOR EACH ROW
  WHEN (NEW.target_type = 'post')
  EXECUTE FUNCTION public.handle_post_like_notification();

-- Trigger: Notify user when their post receives a comment
CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  -- Get post author
  SELECT author INTO post_author
  FROM public.posts
  WHERE id = NEW.post_id;

  -- Create notification if not own comment
  IF post_author IS NOT NULL AND post_author != NEW.author THEN
    PERFORM public.create_notification(
      post_author,
      'post_commented',
      jsonb_build_object(
        'post_id', NEW.post_id,
        'comment_id', NEW.id,
        'comment_author', NEW.author
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_notification();

-- Trigger: Notify user when followed
CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the user being followed
  PERFORM public.create_notification(
    NEW.following,
    'user_followed',
    jsonb_build_object(
      'follower', NEW.follower,
      'follow_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER follow_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_follow_notification();

-- Trigger: Notify vendor when new order is created
CREATE OR REPLACE FUNCTION public.handle_order_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.vendor,
      'new_order',
      jsonb_build_object(
        'order_id', NEW.id,
        'buyer', NEW.buyer,
        'total', NEW.total,
        'status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_notification
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_notification();

-- Trigger: Notify vendor when booking is requested
CREATE OR REPLACE FUNCTION public.handle_booking_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor IS NOT NULL AND NEW.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.vendor,
      'booking_requested',
      jsonb_build_object(
        'booking_id', NEW.id,
        'listing_id', NEW.listing_id,
        'buyer', NEW.buyer,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_notification
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.handle_booking_notification();

-- Trigger: Notify buyer when booking is confirmed/canceled
CREATE OR REPLACE FUNCTION public.handle_booking_update_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify buyer of status change
  IF NEW.buyer IS NOT NULL AND OLD.status != NEW.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM public.create_notification(
        NEW.buyer,
        'booking_confirmed',
        jsonb_build_object(
          'booking_id', NEW.id,
          'listing_id', NEW.listing_id,
          'vendor', NEW.vendor,
          'start_time', NEW.start_time,
          'end_time', NEW.end_time
        )
      );
    ELSIF NEW.status = 'canceled' THEN
      PERFORM public.create_notification(
        NEW.buyer,
        'booking_canceled',
        jsonb_build_object(
          'booking_id', NEW.id,
          'listing_id', NEW.listing_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_update_notification
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_booking_update_notification();

