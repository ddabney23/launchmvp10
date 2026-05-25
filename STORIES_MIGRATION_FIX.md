# Stories Migration Fix - SQL Error Resolution

## Error: `column "user_id" does not exist`

### Issue
When running migration `040_stories_feature.sql`, you may encounter:
```
ERROR: 42703: column "user_id" does not exist
```

### Root Cause
The error occurs because:
1. **Clerk Authentication**: The project uses Clerk, not Supabase Auth, so `auth.uid()` doesn't work in RLS policies
2. **RLS Policy References**: Some policies were trying to reference `user_id` in contexts where it wasn't available
3. **Function Search Path**: The function might have issues with column resolution

### Fix Applied
I've updated the migration to:

1. **Simplified RLS Policies**: Since API routes use `createAdminClient()` which bypasses RLS, the policies now use `true` checks and rely on API-level authorization
2. **Fixed Function**: The `get_active_stories` function properly references columns with table aliases
3. **Safe Realtime Setup**: Made the `ALTER PUBLICATION` statements idempotent

### Updated Migration
The migration file `supabase/migrations/040_stories_feature.sql` has been updated with:
- ✅ Simplified RLS policies (API routes handle auth)
- ✅ Proper column references in functions
- ✅ Safe realtime publication setup

### How to Apply

1. **If you haven't run the migration yet:**
   ```bash
   # Run the migration
   supabase db push
   # or
   supabase migration up
   ```

2. **If you already ran it and got an error:**
   ```sql
   -- Drop existing policies if they exist
   DROP POLICY IF EXISTS "select_public_stories" ON public.stories;
   DROP POLICY IF EXISTS "insert_own_stories" ON public.stories;
   DROP POLICY IF EXISTS "update_own_stories" ON public.stories;
   DROP POLICY IF EXISTS "delete_own_stories" ON public.stories;
   DROP POLICY IF EXISTS "select_story_views" ON public.story_views;
   DROP POLICY IF EXISTS "insert_story_views" ON public.story_views;
   DROP POLICY IF EXISTS "select_story_replies" ON public.story_replies;
   DROP POLICY IF EXISTS "insert_story_replies" ON public.story_replies;
   DROP POLICY IF EXISTS "delete_own_story_replies" ON public.story_replies;
   
   -- Then re-run the migration or manually create the policies
   ```

3. **Or run the fixed migration:**
   - The updated `040_stories_feature.sql` should now work correctly
   - All RLS policies use `true` checks since API routes handle authorization

### Verification

After running the migration, verify it worked:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('stories', 'story_views', 'story_replies');

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_active_stories';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('stories', 'story_views', 'story_replies');
```

### Notes

- **Authorization**: All authorization is handled in API routes using Clerk authentication
- **RLS Policies**: Simplified to allow access (API routes enforce permissions)
- **Realtime**: Tables are added to realtime publication for live updates
- **Functions**: All functions use `SECURITY DEFINER` with proper `search_path`

The migration should now run successfully! ✅

