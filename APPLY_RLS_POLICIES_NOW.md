# 🔐 Apply Storage RLS Policies - REQUIRED

## ⚠️ CRITICAL SECURITY STEP

Your storage buckets are created but **POLICIES ARE NOT YET APPLIED**. 
Files can be uploaded but security rules are missing!

## 📋 Steps to Apply RLS Policies

### 1. Open Supabase Dashboard
- Go to [https://app.supabase.com](https://app.supabase.com)
- Select your project

### 2. Navigate to SQL Editor
- Click **SQL Editor** in the left sidebar
- Click **New Query** button

### 3. Copy the SQL Script
- Open: `scripts/setup-storage-buckets.sql`
- Copy the **ENTIRE CONTENTS** (all 141 lines)
  
### 4. Paste and Execute
- Paste the SQL into the Supabase SQL Editor
- Click **RUN** or press `Ctrl+Enter`
- Wait for "Success. No rows returned" message

### 5. Verify Policies Applied
- Go to **Storage** → **Policies** in Supabase Dashboard
- You should see policies for:
  - ✅ avatars (4 policies: SELECT, INSERT, UPDATE, DELETE)
  - ✅ images (4 policies: SELECT, INSERT, UPDATE, DELETE)
  - ✅ videos (4 policies: SELECT, INSERT, UPDATE, DELETE)
  - ✅ documents (4 policies: SELECT, INSERT, UPDATE, DELETE)

## 📝 What These Policies Do

### **avatars** bucket (Public)
- ✅ Anyone can view avatars
- ✅ Users can upload/update/delete their own avatars only
- 📁 Structure: `avatars/{user_id}/filename.jpg`

### **images** bucket (Public)
- ✅ Anyone can view images
- ✅ Authenticated users can upload images
- ✅ Users can update/delete their own images only
- 📁 Structure: `images/{user_id}/filename.jpg`

### **videos** bucket (Public)
- ✅ Anyone can view videos
- ✅ Authenticated users can upload videos
- ✅ Users can update/delete their own videos only
- 📁 Structure: `videos/{user_id}/filename.mp4`

### **documents** bucket (Private)
- 🔒 Users can ONLY view their own documents
- ✅ Users can upload/update/delete their own documents only
- 📁 Structure: `documents/{user_id}/filename.pdf`

## 🧪 Test After Applying

Run the upload API test:
```bash
# Test file upload (should work after RLS applied)
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -F "file=@test-image.jpg" \
  -F "bucket=avatars"
```

## ✅ Expected Results

After applying policies:
- ✅ File uploads work correctly
- ✅ Users can only access their own private files
- ✅ Public files are viewable by everyone
- ✅ Unauthorized uploads are blocked
- ✅ Cross-user file access is prevented

## 🚨 Security Note

**DO NOT skip this step!** Without RLS policies:
- ❌ Anyone could upload files to any bucket
- ❌ No size or type restrictions enforced at DB level
- ❌ Users could access other users' private documents
- ❌ No folder structure enforcement

## ℹ️ Troubleshooting

### "Policy already exists" error
- This is OK! It means the policy was already applied
- The script uses `CREATE POLICY` which will error if policies exist
- You can safely ignore these errors

### Policies not showing in Dashboard
- Refresh the page
- Check the **Storage** → **Policies** section
- Make sure you're in the correct project

### Upload still failing
- Check browser console for exact error
- Verify Clerk authentication is working
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly

## 🎯 Next Steps After Applying

Once RLS policies are applied:
1. ✅ Test file uploads via `/api/upload` endpoint
2. ✅ Test file access (public vs private)
3. ✅ Continue with Phase 3.2: Test Existing Routes
4. ✅ Implement missing API routes

---

**Current Status**: Policies are ready in SQL file but NOT YET APPLIED  
**Action Required**: Follow steps above to apply NOW  
**Time Estimate**: 2-3 minutes
