# Stories Migration Fix - Final Solution

## Error: `column "user_id" does not exist`

### Root Cause
The error occurs when:
1. The `stories` table already exists from a previous migration attempt
2. The table structure is incomplete or different
3. PostgreSQL tries to reference `user_id` before the table is properly created

### Solution Applied
I've updated the migration to:
1. **Drop existing tables first** - This ensures a clean slate
2. **Recreate tables with correct structure** - All columns properly defined
3. **Use CASCADE** - Ensures dependent objects are also dropped

### Updated Migration
The migration now:
- Drops `stories`, `story_views`, and `story_replies` tables if they exist
- Recreates them with the correct structure
- All functions and triggers are recreated
- All indexes are recreated

### ⚠️ Important Note
**This will delete all existing stories data!** If you have stories you want to keep, back them up first:

```sql
-- Backup existing stories (if any)
CREATE TABLE stories_backup AS SELECT * FROM stories;
CREATE TABLE story_views_backup AS SELECT * FROM story_views;
CREATE TABLE story_replies_backup AS SELECT * FROM story_replies;
```

### How to Apply

1. **Run the updated migration:**
   ```sql
   -- Copy the entire content of supabase/migrations/040_stories_feature.sql
   -- Paste into Supabase Dashboard → SQL Editor
   -- Click "Run"
   ```

2. **Or use the migration script:**
   ```powershell
   npm run migrate
   ```

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

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stories' 
AND table_schema = 'public';
```

You should see:
- `id` (uuid)
- `user_id` (uuid) ✅
- `media_url` (text)
- `media_type` (text)
- `caption` (text)
- `visibility` (text)
- `view_count` (integer)
- `expires_at` (timestamptz)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### If Error Persists

If you still get the error, try running the migration in parts:

1. **Drop everything first:**
   ```sql
   DROP TABLE IF EXISTS public.story_replies CASCADE;
   DROP TABLE IF EXISTS public.story_views CASCADE;
   DROP TABLE IF EXISTS public.stories CASCADE;
   DROP FUNCTION IF EXISTS get_active_stories(UUID) CASCADE;
   DROP FUNCTION IF EXISTS increment_story_view_count() CASCADE;
   DROP FUNCTION IF EXISTS cleanup_expired_stories() CASCADE;
   DROP FUNCTION IF EXISTS update_stories_updated_at() CASCADE;
   ```

2. **Then run the full migration again**

The migration should now work! ✅

