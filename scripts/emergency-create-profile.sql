-- Emergency fix: Create profile for Clerk user
-- Run this in Supabase SQL Editor immediately

-- Insert profile with proper Clerk ID
INSERT INTO profiles (
  clerk_user_id,
  email,
  username,
  display_name,
  is_admin,
  onboarding_completed,
  created_at,
  updated_at
)
VALUES (
  'user_35REqBwCK0OWulDHjBgeaPdfBnO',
  'ddabney23@gmail.com',
  'optimixadmin',
  'Demontre Dabney',
  true,
  false,  -- Set to false so onboarding can complete properly
  NOW(),
  NOW()
)
ON CONFLICT (clerk_user_id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  is_admin = true,
  updated_at = NOW();

-- Verify it was created
SELECT 
  id,
  clerk_user_id,
  email,
  username,
  is_admin,
  onboarding_completed,
  created_at
FROM profiles
WHERE clerk_user_id = 'user_35REqBwCK0OWulDHjBgeaPdfBnO';
