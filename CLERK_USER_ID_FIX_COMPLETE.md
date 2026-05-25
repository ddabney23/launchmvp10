# Clerk User ID Fix Complete ✅

## Problem
The application was trying to use Clerk user IDs (strings like `"user_35REqBwCK0OWulDHjBgeaPdfBnO"`) directly as UUID primary keys in the `profiles` table, causing the error:
```
invalid input syntax for type uuid: "user_35REqBwCK0OWulDHjBgeaPdfBnO"
```

## Solution
Added a `clerk_user_id` column to the `profiles` table to store Clerk user IDs separately from the UUID primary key.

## Changes Made

### 1. Database Migration
- **File**: `supabase/migrations/027_add_clerk_user_id.sql`
- Added `clerk_user_id TEXT UNIQUE` column to `profiles` table
- Created index for fast lookups
- Added documentation comment

### 2. Frontend API Client
- **File**: `src/lib/api.ts`
- Updated `getProfile()` to query by `clerk_user_id` instead of `id`
- Updated profile creation fallback to use `clerk_user_id`

### 3. Clerk Webhook
- **File**: `app/api/webhooks/clerk/route.ts`
- Updated `user.created` handler to store Clerk ID in `clerk_user_id` column
- Updated `user.updated` handler to query by `clerk_user_id`
- Profile `id` is now auto-generated as UUID

### 4. API Routes Updated

#### Gamification
- **File**: `app/api/gamification/update/route.ts`
- Admin check now uses `clerk_user_id`
- Profile lookups handle both Clerk user IDs and UUIDs
- Updates use profile UUID `id` for foreign key references

#### Vendor Routes
- **File**: `app/api/vendor/applications/route.ts`
- Admin check uses `clerk_user_id`

- **File**: `app/api/vendor/verify/route.ts`
- Profile lookups use `clerk_user_id`
- Profile updates get UUID first, then update by UUID

#### Admin Routes
- **File**: `app/api/admin/badges/route.ts`
- Admin check uses `clerk_user_id`

- **File**: `app/api/admin/users/[id]/route.ts`
- All admin checks use `clerk_user_id`

- **File**: `app/api/admin/users/search/route.ts`
- Admin check uses `clerk_user_id`

- **File**: `app/api/admin/users/export/route.ts`
- Admin check uses `clerk_user_id`

#### Webhook Logs
- **File**: `app/api/webhooks/logs/route.ts`
- Admin check uses `clerk_user_id`
- Fixed syntax error (duplicate code removed)

#### Posts API
- **File**: `app/api/posts/[id]/route.ts`
- Admin check uses `clerk_user_id`

#### Vendor Applications
- **File**: `app/api/vendor/applications/[id]/route.ts`
- Admin check uses `clerk_user_id`

## Migration Instructions

1. **Run the migration**:
   ```bash
   # If using Supabase CLI
   supabase migration up
   
   # Or apply manually in Supabase dashboard
   # Copy contents of supabase/migrations/027_add_clerk_user_id.sql
   ```

2. **Backfill existing profiles** (if any):
   ```sql
   -- If you have existing profiles without clerk_user_id, you'll need to:
   -- 1. Get Clerk user IDs from your Clerk dashboard
   -- 2. Update profiles table:
   UPDATE profiles 
   SET clerk_user_id = 'user_xxx' 
   WHERE id = 'uuid-here';
   ```

3. **Verify the migration**:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name = 'clerk_user_id';
   ```

## Testing Checklist

- [ ] Run migration successfully
- [ ] Test user registration (Clerk webhook creates profile)
- [ ] Test `getProfile()` in frontend
- [ ] Test admin routes (should authenticate correctly)
- [ ] Test vendor verification flow
- [ ] Test gamification updates
- [ ] Verify no UUID errors in console

## Important Notes

1. **Profile ID**: The `profiles.id` column remains a UUID and is used for:
   - Foreign key references in other tables
   - Internal database relationships
   - Updates and deletes

2. **Clerk User ID**: The `clerk_user_id` column is used for:
   - Looking up profiles from Clerk authentication
   - Frontend API calls
   - Admin checks in API routes

3. **Backward Compatibility**: The code handles both Clerk user IDs and UUIDs in some places (like gamification) to support legacy data if needed.

## Files Modified

1. `supabase/migrations/027_add_clerk_user_id.sql` (NEW)
2. `src/lib/api.ts`
3. `app/api/webhooks/clerk/route.ts`
4. `app/api/gamification/update/route.ts`
5. `app/api/vendor/applications/route.ts`
6. `app/api/vendor/verify/route.ts`
7. `app/api/admin/badges/route.ts`
8. `app/api/admin/users/[id]/route.ts`
9. `app/api/admin/users/search/route.ts`
10. `app/api/admin/users/export/route.ts`
11. `app/api/webhooks/logs/route.ts`
12. `app/api/posts/[id]/route.ts`
13. `app/api/vendor/applications/[id]/route.ts`

## Status

✅ **Migration created**
✅ **Migration applied** (completed by user)
✅ **Frontend updated**
✅ **Webhook updated**
✅ **API routes updated**

---

## Testing Checklist

After migration, test the following:

- [x] Migration applied successfully
- [ ] User registration (Clerk webhook creates profile with clerk_user_id)
- [ ] Profile loading in frontend (no UUID errors)
- [ ] Admin routes authentication
- [ ] Vendor verification flow
- [ ] Gamification updates
- [ ] User profile updates
- [ ] All API routes work correctly

## Verification

To verify the migration was successful, run this SQL query:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
AND column_name = 'clerk_user_id';
```

Expected result:
- `column_name`: clerk_user_id
- `data_type`: text
- `is_nullable`: YES

---

**Status**: ✅ **COMPLETE** - Migration applied, code updated, ready for testing!

