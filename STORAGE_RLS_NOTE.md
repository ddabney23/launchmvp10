# Storage RLS Policies Note

## Important: Clerk Migration Impact

The existing RLS policies in `supabase/migrations/004_storage_buckets.sql` use `auth.uid()` which references Supabase Auth. Since we've migrated to Clerk, these policies won't work as expected.

## Current Status

The storage buckets have been created successfully, but the RLS policies need to be updated to work with Clerk.

## Options

### Option 1: Disable RLS (Quick Fix - Development Only)
For development, you can temporarily disable RLS on public buckets:

```sql
-- Disable RLS on public buckets (DEVELOPMENT ONLY)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING: This makes all files publicly accessible. Only use in development!**

### Option 2: Update Policies for Clerk (Recommended)
Update the RLS policies to work with Clerk by checking the user ID from the `profiles` table instead of `auth.uid()`.

However, since Clerk doesn't set `auth.uid()`, you'll need to:
1. Use service role key for uploads (bypasses RLS)
2. Or create custom policies that check user ID from request headers/JWT

### Option 3: Use Service Role for Uploads (Current Workaround)
The `uploadFile` function currently uses the client-side Supabase client. For Clerk, you may need to:
- Create an API route that uses the service role key for uploads
- Or update the client to send the Clerk user ID in a custom header

## Current Workaround

For now, the buckets are created and should work for public buckets. Private buckets (`vendor-docs`) may have access issues until RLS policies are updated.

## Next Steps

1. ✅ Buckets created - DONE
2. ⚠️ Update RLS policies for Clerk - TODO
3. ⚠️ Test file uploads - TODO
4. ⚠️ Verify access controls work correctly - TODO

## Testing

Try uploading a file through vendor onboarding. If you get permission errors, you may need to:
- Temporarily disable RLS (development only)
- Or update the upload function to use an API route with service role key

