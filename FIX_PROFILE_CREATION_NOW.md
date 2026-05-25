# 🔧 CRITICAL FIX: Profile Creation Error

## 🚨 Problem
"Failed to create profile" error during onboarding because the `profiles` table has a foreign key constraint to `auth.users`, but we're using Clerk (not Supabase Auth).

## ✅ Solution
Run the new migration to fix the profiles table schema.

---

## 📋 Steps to Fix (DO THIS NOW)

### Step 1: Run Migration in Supabase

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Copy & Paste This SQL (WITHOUT the ```sql markers):**

-- Migration: Fix profiles table for Clerk authentication
-- Remove foreign key constraint to auth.users and make id a regular UUID primary key

-- Step 1: Drop the foreign key constraint on id if it exists
DO $$ 
BEGIN
    -- Drop foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%profiles%fkey' 
        AND table_name = 'profiles' 
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    END IF;
END $$;

-- Step 2: Ensure id column is UUID with default gen_random_uuid()
-- This allows new profiles to be created without needing to reference auth.users
ALTER TABLE public.profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 3: Ensure clerk_user_id column exists and is unique
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- Step 4: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id 
ON public.profiles(clerk_user_id) 
WHERE clerk_user_id IS NOT NULL;

-- Step 5: Add email column if not exists (for Clerk users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 6: Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON public.profiles(email) 
WHERE email IS NOT NULL;

-- Step 7: Add onboarding_completed column if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN public.profiles.clerk_user_id IS 
  'Clerk authentication user ID (e.g., user_2abc123). Primary identifier for Clerk-authenticated users.';

COMMENT ON COLUMN public.profiles.id IS 
  'UUID primary key for internal references. Auto-generated, not tied to auth.users.';

COMMENT ON TABLE public.profiles IS 
  'User profiles for Clerk-authenticated users. id is auto-generated UUID, clerk_user_id is the Clerk user identifier.';

4. **Click "RUN"**
   - Should see "Success. No rows returned"

### Step 2: Verify Migration

Run this query to check the table structure:

```sql
-- Verify profiles table structure
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` → uuid (default: gen_random_uuid())
- `clerk_user_id` → text (unique)
- `username` → text
- `display_name` → text
- `email` → text
- `bio` → text
- `avatar_url` → text
- `is_vendor` → boolean
- `vendor_verified` → boolean
- `onboarding_completed` → boolean
- `credits` → integer
- `points` → integer
- `created_at` → timestamp
- `updated_at` → timestamp

### Step 3: Test Onboarding

1. **Sign out of your app**
2. **Create a new account**
   - Go to `/auth`
   - Sign up with new email

3. **Complete onboarding**
   - Choose "I'm a Customer"
   - Select interests
   - Add avatar (optional)
   - Click "Get Started"

4. **Expected Result:**
   - ✅ No "Failed to create profile" error
   - ✅ Redirects to `/home`
   - ✅ Profile created successfully

### Step 4: Verify in Database

```sql
-- Check if profile was created
SELECT 
  id,
  clerk_user_id,
  username,
  email,
  onboarding_completed,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;
```

Should see your new profile with:
- `clerk_user_id` populated (e.g., "user_2abc123")
- `onboarding_completed` = true
- `email` = your email

---

## 🔍 What This Migration Does

### Before:
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  -- ^^^ This caused errors with Clerk because auth.users doesn't have our IDs
  username TEXT,
  ...
);
```

### After:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ^^^ Auto-generates UUID, no foreign key constraint
  clerk_user_id TEXT UNIQUE,
  -- ^^^ Stores Clerk user ID for lookups
  username TEXT,
  email TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  ...
);
```

---

## 🎯 Why It Failed Before

1. **Old Schema:** `id UUID REFERENCES auth.users`
   - Expected `id` to exist in `auth.users` table
   - Clerk doesn't use Supabase Auth, so `auth.users` is empty
   - Foreign key constraint prevented inserts

2. **Clerk Uses String IDs:** `user_2abc123xyz`
   - Can't be stored in UUID field
   - Needed separate `clerk_user_id` TEXT field

3. **Missing Columns:**
   - `email` - needed for profile lookup
   - `onboarding_completed` - needed for onboarding flow

---

## ✅ Checklist

- [ ] Ran migration SQL in Supabase
- [ ] Verified table structure (Step 2)
- [ ] Tested customer onboarding
- [ ] Tested vendor onboarding
- [ ] Verified profile in database (Step 4)
- [ ] No more "Failed to create profile" errors

---

## 🐛 If Still Failing

### Check Browser Console
1. Press F12
2. Go to Console tab
3. Look for error details
4. Check the actual error message from API

### Check Supabase Logs
1. Go to Supabase Dashboard
2. Click "Logs" → "Postgres Logs"
3. Look for INSERT errors
4. Check constraint violations

### Common Issues

**Error: "duplicate key value violates unique constraint"**
- Solution: Username already taken, should auto-generate unique one
- Check: Code retries with timestamp appended

**Error: "null value in column violates not-null constraint"**
- Solution: Missing required field
- Check: Verify `clerk_user_id` is being passed

**Error: "permission denied for table profiles"**
- Solution: RLS policy blocking insert
- Check: API uses admin client to bypass RLS

---

## 📝 Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/036_fix_profiles_clerk_fkey.sql` | **NEW** - Fixes table schema |
| `src/views/CustomerOnboarding.tsx` | Added debug logging |
| `ONBOARDING_PROFILE_FIX.md` | Testing guide |
| `FIX_PROFILE_CREATION_NOW.md` | This file |

---

**Run the migration now and test onboarding!** 🚀
