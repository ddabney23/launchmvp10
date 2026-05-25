# Supabase Storage Buckets Setup Guide

## Problem

If you're seeing "Bucket not found" errors, it means the required Supabase storage buckets haven't been created yet.

## Quick Fix

### Option 1: Run the Setup Script (Recommended)

```bash
npm run setup:buckets
```

This script will automatically create all required storage buckets.

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Storage** in the sidebar
4. Click **New bucket** and create the following buckets:

#### Required Buckets:

1. **vendor-assets** (Public)
   - Purpose: Vendor banners and logos
   - Public: Yes
   - File size limit: 10MB
   - Allowed types: Images (JPEG, PNG, WebP, GIF)

2. **vendor-docs** (Private)
   - Purpose: Vendor business documents (IDs, licenses)
   - Public: No
   - File size limit: 10MB
   - Allowed types: PDF, Images (JPEG, PNG)

3. **listings** (Public)
   - Purpose: Product listing images
   - Public: Yes
   - File size limit: 10MB
   - Allowed types: Images (JPEG, PNG, WebP, GIF)

4. **avatars** (Public)
   - Purpose: User profile avatars
   - Public: Yes
   - File size limit: 5MB
   - Allowed types: Images (JPEG, PNG, WebP)

5. **posts** (Public)
   - Purpose: Post media (images, videos)
   - Public: Yes
   - File size limit: 50MB
   - Allowed types: Images, Videos (MP4, WebM)

## Storage Policies (RLS)

After creating buckets, you may need to set up Row Level Security (RLS) policies:

### Public Buckets (vendor-assets, listings, avatars, posts)
- **Read**: Allow public read access
- **Write**: Allow authenticated users to upload

### Private Buckets (vendor-docs)
- **Read**: Only allow admins and the bucket owner
- **Write**: Only allow authenticated users

## Getting Your Service Role Key

1. Go to Supabase Dashboard → **Settings** → **API**
2. Find **service_role** key (keep this secret!)
3. Add to `.env.local`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Troubleshooting

### "Bucket not found" error persists
- Verify buckets exist in Supabase Dashboard → Storage
- Check bucket names match exactly (case-sensitive)
- Ensure you're using the correct Supabase project

### "Permission denied" errors
- Check RLS policies are set correctly
- Verify service role key has admin access
- Check bucket is set to public/private as needed

### Upload fails
- Check file size is within limits
- Verify file type is allowed
- Check network connection
- Review Supabase logs for detailed errors

## Testing

After setup, test by:
1. Completing vendor onboarding
2. Uploading a profile avatar
3. Creating a product listing with an image

All should work without "Bucket not found" errors.

