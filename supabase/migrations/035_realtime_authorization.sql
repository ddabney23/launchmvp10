-- Migration: Realtime Authorization for Private Channels
-- Enables private channel access for authenticated users
-- Required for Supabase Realtime private channels
-- Date: 2025-01

-- ============================================
-- Realtime Authorization Policies
-- ============================================
-- These policies control access to Realtime private channels
-- Based on Supabase documentation: https://supabase.com/docs/guides/realtime/authorization

-- Allow authenticated users to receive broadcasts on private channels
CREATE POLICY IF NOT EXISTS "authenticated_users_can_receive_broadcasts" 
ON realtime.messages
FOR SELECT 
TO authenticated
USING (true);

-- Allow authenticated users to send broadcasts on private channels
CREATE POLICY IF NOT EXISTS "authenticated_users_can_send_broadcasts" 
ON realtime.messages
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Note: Since this project uses Clerk for authentication, these policies
-- may need to be adjusted if you're using custom JWT tokens.
-- For Clerk integration, you may need to:
-- 1. Create custom JWT tokens with Clerk user info
-- 2. Set the token in Supabase client: supabase.realtime.setAuth('your-jwt-token')
-- 3. Or use service role for server-side realtime operations

COMMENT ON POLICY "authenticated_users_can_receive_broadcasts" ON realtime.messages IS 
'Allows authenticated users to receive broadcasts on private Realtime channels';

COMMENT ON POLICY "authenticated_users_can_send_broadcasts" ON realtime.messages IS 
'Allows authenticated users to send broadcasts on private Realtime channels';

