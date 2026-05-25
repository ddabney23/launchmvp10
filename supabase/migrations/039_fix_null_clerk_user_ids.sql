-- Fix profiles with null clerk_user_id
-- This happens when profiles were created before Clerk migration

-- IMPORTANT: You need to manually update this with your actual Clerk user IDs
-- Run this query first to see which profiles need updating:
-- SELECT id, username, email, clerk_user_id FROM profiles WHERE clerk_user_id IS NULL;

-- Then update each profile with the correct Clerk user ID
-- Replace 'YOUR_CLERK_USER_ID' and 'PROFILE_ID' with actual values

-- Example (DO NOT RUN AS-IS, UPDATE WITH YOUR VALUES):
-- UPDATE profiles 
-- SET clerk_user_id = 'user_2xxxxxxxxxxxxx' 
-- WHERE id = '768cd725-8424-4e62-ab1b-b773cc3eb997';

-- UPDATE profiles 
-- SET clerk_user_id = 'user_2yyyyyyyyyyyyyy' 
-- WHERE id = '09ea65a5-e917-49fb-a2b3-cbb2587ee186';

-- After updating, verify:
-- SELECT id, username, email, clerk_user_id FROM profiles ORDER BY created_at;
