# Supabase RLS + Clerk Integration Guide

## ⚠️ Important: RLS Policies and Clerk Authentication

This project uses **Clerk** for authentication, but the database RLS policies use `auth.uid()` which is for **Supabase Auth**. This creates a compatibility issue.

## Current Situation

### How It Works Now
- **Frontend**: Uses Clerk for authentication
- **API Routes**: Use `createAdminClient()` (service role) which **bypasses RLS**
- **RLS Policies**: Use `auth.uid()` which won't work with Clerk users

### The Problem
1. RLS policies check `auth.uid()` but Clerk users don't have Supabase Auth sessions
2. API routes bypass RLS using service role key
3. Direct database access (if any) would be blocked by RLS

## Solutions

### Option 1: Use Service Role for All Operations (Current Approach)
**Pros:**
- Simple - no changes needed
- Works with current architecture

**Cons:**
- RLS policies are not enforced
- Less secure if someone gets service role key
- Can't use RLS for fine-grained access control

### Option 2: Create Custom JWT Tokens with Clerk User Info
**Pros:**
- RLS policies can work
- More secure
- Follows Supabase best practices

**Cons:**
- More complex setup
- Need to generate JWT tokens

**Implementation:**
```typescript
// Create a JWT token with Clerk user info
import jwt from 'jsonwebtoken'

async function createSupabaseJWT(clerkUserId: string) {
  // Get profile UUID from clerk_user_id
  const profile = await getProfileByClerkId(clerkUserId)
  
  const payload = {
    sub: profile.id, // Use profile UUID as subject
    role: 'authenticated',
    email: user.email,
  }
  
  return jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
    expiresIn: '1h',
  })
}

// Use in client
const token = await createSupabaseJWT(clerkUserId)
supabase.realtime.setAuth(token)
```

### Option 3: Create Helper Functions for RLS Policies
**Pros:**
- RLS policies can check Clerk user ID
- Works with current setup

**Cons:**
- Need to pass Clerk user ID to database
- More complex RLS policies

**Implementation:**
```sql
-- Create helper function to get profile UUID from Clerk user ID
CREATE OR REPLACE FUNCTION get_profile_uuid_from_clerk(clerk_user_id TEXT)
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE clerk_user_id = get_profile_uuid_from_clerk.clerk_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Use in RLS policies (would need custom JWT with clerk_user_id claim)
CREATE POLICY "select_own_messages" ON messages
  FOR SELECT
  USING (
    sender_id = get_profile_uuid_from_clerk(current_setting('request.jwt.claims', true)::json->>'clerk_user_id')
  );
```

## Recommended Approach

For now, **continue using Option 1** (service role) since:
1. All API routes already use `createAdminClient()`
2. Application-level authorization is handled in API routes
3. RLS policies serve as a backup security layer

## Future Improvements

1. **Implement Option 2** (Custom JWT) for better security
2. **Update RLS policies** to work with Clerk user IDs
3. **Use RLS for direct database access** protection

## Realtime Authorization

For Realtime private channels, you need to:
1. Set JWT token: `supabase.realtime.setAuth(token)`
2. Or use service role for server-side realtime operations

See `supabase/migrations/035_realtime_authorization.sql` for Realtime authorization policies.

## Migration Status

- ✅ RLS enabled on all tables (migration 034)
- ✅ Basic RLS policies created
- ⚠️ Policies use `auth.uid()` - won't work with Clerk directly
- ✅ Realtime authorization policies created (migration 035)
- ✅ Private channels implemented in code

## Next Steps

1. Apply migrations 034 and 035
2. Test that API routes still work (they use service role, so should be fine)
3. Consider implementing custom JWT tokens for better RLS integration
4. Update RLS policies to support Clerk if implementing custom JWT

