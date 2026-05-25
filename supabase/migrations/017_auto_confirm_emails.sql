-- Migration: Auto-confirm emails for development
-- This allows users to login without email confirmation
-- For production, you may want to remove this and handle email confirmation properly

-- Function to auto-confirm email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm email for new users (for development)
  -- In production, you should remove this and use email confirmation
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-confirm emails on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also confirm existing unconfirmed emails (for development)
-- Remove this in production or run manually for specific users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- Comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-confirms email for new users (development only - remove in production)';

