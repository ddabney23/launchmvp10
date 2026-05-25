# Vendor Application Submission - Complete Fix Guide

## ✅ What Has Been Fixed

### 1. Error Handling Improvements
- ✅ API route now returns detailed error messages
- ✅ Frontend displays user-friendly error messages
- ✅ Specific error types are detected and handled:
  - Database table missing
  - Authentication errors
  - Validation errors
  - General server errors

### 2. Test Scripts Created
- ✅ `scripts/check-vendor-table.js` - Check if table exists
- ✅ `scripts/test-vendor-api.js` - Test API endpoint
- ✅ Added npm scripts: `npm run check:vendor-table`

### 3. User Experience Improvements
- ✅ Toast notifications for all error types
- ✅ Clear error messages with actionable information
- ✅ Success message shows application is under review

## ⚠️ ACTION REQUIRED: Create Database Table

The `vendor_applications` table does NOT exist in your database. You MUST create it before vendor applications will work.

### Quick Fix (Choose One Method)

#### Method 1: Supabase Dashboard (Easiest - Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Open the file: `supabase/migrations/025_vendor_applications.sql`
   - Copy ALL the SQL code
   - Paste it into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Table Created**
   - Run this query to verify:
   ```sql
   SELECT * FROM vendor_applications LIMIT 1;
   ```
   - If it runs without error, the table exists!

#### Method 2: Supabase CLI

If you have Supabase CLI installed:

```bash
# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Verify Table Exists

After creating the table, verify it exists:

```bash
npm run check:vendor-table
```

You should see: `✅ Table exists!`

## 🧪 Testing the Fix

### 1. Check Table Exists
```bash
npm run check:vendor-table
```

### 2. Test Vendor Onboarding
1. Start your development server: `npm run dev`
2. Sign in to your application
3. Navigate to vendor onboarding
4. Fill out the form and submit
5. You should see a success message

### 3. Check Admin Dashboard
1. Sign in as an admin
2. Go to Admin Dashboard → Vendors → Pending
3. You should see the submitted application

## 📋 What the Table Stores

The `vendor_applications` table stores:
- Business information (name, type, tax ID)
- Business address
- Contact information (phone)
- Verification documents (ID, business license)
- Application status (pending/approved/denied)
- Review information (reviewed by, denial reason)
- Timestamps (submitted, reviewed, created, updated)

## 🔍 Troubleshooting

### Error: "Database table not found"
- **Solution**: Run the migration SQL in Supabase Dashboard (see Method 1 above)

### Error: "Authentication failed"
- **Solution**: Make sure you're signed in with Clerk
- Check that `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in `.env.local`

### Error: "Invalid request data"
- **Solution**: Check the console for validation errors
- Make sure all required fields are filled out correctly

### Error: "Failed to upload file"
- **Solution**: Make sure storage buckets are created
- Run: `npm run setup:buckets`

### Still Getting Errors?
1. Check browser console for detailed error logs
2. Check server logs for API errors
3. Verify environment variables are set:
   ```bash
   # Check .env.local has:
   - NEXT_PUBLIC_SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   ```

## 📝 Next Steps After Fix

Once the table is created:

1. ✅ Vendor applications will submit successfully
2. ✅ Applications appear in admin dashboard
3. ✅ Admins can approve/deny applications
4. ✅ Users receive notifications about their application status

## 🎯 Summary

**Current Status**: Table missing - needs to be created
**Action Required**: Run migration SQL in Supabase Dashboard
**After Fix**: Vendor application submission will work end-to-end

---

**Need Help?** Check the error messages in the browser console - they now provide detailed information about what went wrong.

