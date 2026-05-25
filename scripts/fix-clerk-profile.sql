-- Fix missing profile for Clerk user ddabney23@gmail.com
-- This should have been created by the Clerk webhook but wasn't

-- Check if profile exists
SELECT id, email, username, clerk_user_id, is_admin, onboarding_completed 
FROM profiles 
WHERE clerk_user_id = 'user_35REqBwCK0OWulDHjBgeaPdfBnO';

-- If it doesn't exist, create it
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
  true,
  NOW(),
  NOW()
)
ON CONFLICT (clerk_user_id) 
DO UPDATE SET
  is_admin = true,
  onboarding_completed = true,
  email = 'ddabney23@gmail.com',
  username = 'optimixadmin',
  display_name = 'Demontre Dabney',
  updated_at = NOW();

-- Verify the profile was created/updated
SELECT id, email, username, clerk_user_id, is_admin, onboarding_completed 
FROM profiles 
WHERE clerk_user_id = 'user_35REqBwCK0OWulDHjBgeaPdfBnO';
