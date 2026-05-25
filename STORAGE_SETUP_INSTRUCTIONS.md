# Supabase Storage Setup Instructions

## Issue Fixed ✅
The dev server was hanging during startup due to Sentry instrumentation. This has been resolved by temporarily disabling `instrumentation.ts`.

## Current Status

### ✅ Working
- Dev server starts successfully (5.3s)
- All pages load correctly (/, /auth, /onboarding, /admin)
- Middleware and authentication functional
- Database connections working (Supabase, Prisma, Redis)

### ⚠️ Needs Attention
1. **Storage buckets missing** - Getting "Bucket not found" errors
2. **News query disabled** - Temporarily disabled on landing page

## Setup Storage Buckets

You have **two options** to create storage buckets:

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/ofzehffrqzvxlnbaxxby
2. Click on **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Create these buckets:

   **Bucket: avatars**
   - Name: `avatars`
   - Public: ✅ Yes
   - File size limit: 5 MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`

   **Bucket: images**
   - Name: `images`
   - Public: ✅ Yes
   - File size limit: 10 MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif, image/svg+xml`

   **Bucket: videos**
   - Name: `videos`
   - Public: ✅ Yes
   - File size limit: 100 MB
   - Allowed MIME types: `video/mp4, video/webm, video/quicktime`

   **Bucket: documents**
   - Name: `documents`
   - Public: ❌ No (Private)
   - File size limit: 10 MB
   - Allowed MIME types: `application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document`

5. Configure policies for each bucket (see Option 2 for SQL policies)

### Option 2: Using SQL Editor

1. Go to **SQL Editor** in Supabase Dashboard
2. Run the SQL script: `scripts/setup-storage-buckets.sql`
3. This will create all buckets and configure RLS policies automatically

## Storage Policies Explained

The SQL script creates these security policies:

- **Avatars**: Public viewing, but only owners can upload/update/delete
- **Images**: Public viewing, authenticated users can upload, only owners can modify
- **Videos**: Same as images
- **Documents**: Private - only owners can view/upload/modify

## Testing Storage

After setting up buckets, test the upload functionality:

1. Sign in to your app: http://localhost:3000/auth
2. Go to onboarding: http://localhost:3000/onboarding/customer
3. Try uploading an avatar
4. Check for errors in the console

## Next Steps

Once storage is configured:

1. ✅ **Re-enable news query** - Update Index.tsx to properly handle SSR
2. ✅ **Test all upload endpoints** - Verify file uploads work
3. ✅ **Re-enable Sentry** (optional) - Once app is stable
4. 🚀 **Proceed with Phase 3** - API Routes implementation

## Troubleshooting

### "Bucket not found" error
- Make sure buckets are created in Supabase Dashboard → Storage
- Bucket names must exactly match: `avatars`, `images`, `videos`, `documents`

### "Permission denied" on upload
- Check RLS policies are configured
- Ensure user is authenticated
- Verify user ID matches folder structure

### Storage not accessible
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Verify Supabase project is active and not paused

## Files Modified/Created

- ✅ `instrumentation.ts` → Disabled temporarily
- ✅ `src/views/Index.tsx` → News query disabled (enabled: false)
- ✅ `scripts/setup-storage-buckets.sql` → New file
- ✅ `STORAGE_SETUP_INSTRUCTIONS.md` → This file
