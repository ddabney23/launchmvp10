-- Create profile for current logged-in user
-- Clerk ID: user_362rTlPKCxPkymHjRcQtosPabVY

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
  'user_362rTlPKCxPkymHjRcQtosPabVY',
  'CHANGE_THIS@gmail.com',  -- ⚠️ CHANGE THIS TO YOUR EMAIL
  'temp_user',               -- ⚠️ CHANGE THIS TO YOUR USERNAME  
  'User Name',               -- ⚠️ CHANGE THIS TO YOUR NAME
  true,                      -- Make admin
  false,                     -- Allow onboarding to complete
  NOW(),
  NOW()
)
ON CONFLICT (clerk_user_id) DO UPDATE SET
  is_admin = true,
  updated_at = NOW();

-- Verify
SELECT id, clerk_user_id, email, username, is_admin
FROM profiles
WHERE clerk_user_id = 'user_362rTlPKCxPkymHjRcQtosPabVY';
