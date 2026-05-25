# 🔐 Environment Variables - Update Instructions

## ⚠️ IMPORTANT: Your .env file needs updating!

Your `.env` file exists but needs to be properly configured for the new Next.js + Stripe + Prisma setup.

---

## 🎯 Quick Update (Choose One Method)

### Method 1: Interactive Wizard (Recommended) ✨

Run this command to create `.env.local` interactively:

```bash
node scripts/setup-env.js
```

The wizard will:
- ✅ Ask for your Supabase credentials
- ✅ Ask for your Stripe keys (optional)
- ✅ Create `.env.local` automatically
- ✅ Validate the format

### Method 2: Manual Update

1. **Create `.env.local`** (this is the correct file for Next.js):
   ```bash
   # Copy the template
   cp env.example.txt .env.local
   ```

2. **Edit `.env.local`** with your credentials:
   - Open in your editor
   - Replace all `YOUR_*` placeholders
   - Save the file

3. **Verify**:
   ```bash
   npm run verify:env
   ```

---

## 📋 Required Variables

**You MUST have these three** to run the app:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

### Where to Get These:

#### 1. Supabase URL & Key
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → anon/public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 2. Database URL
1. In Supabase Dashboard → **Settings** → **Database**
2. Scroll to **Connection string**
3. Select **URI** tab
4. Copy the string
5. Replace `[YOUR-PASSWORD]` with your actual database password
6. Use as `DATABASE_URL`

**Format**:
```
postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

---

## 💳 Optional: Stripe Keys (For Payments)

Only needed if you want to test/use payment features:

```env
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Where to Get:
1. Go to https://dashboard.stripe.com
2. Make sure you're in **Test mode**
3. Go to **Developers** → **API keys**
4. Copy:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`

---

## 📂 File Location

**Correct file**: `.env.local` (in project root)

```
my-app/
├── .env.local          ← Create this file (Next.js standard)
├── env.example.txt     ← Template to copy from
├── package.json
└── ...
```

**DO NOT** use `.env` - use `.env.local` for Next.js!

---

## ✅ Verification Steps

After creating/updating `.env.local`:

### 1. Check Environment Variables
```bash
npm run verify:env
```

**Expected output**:
```
✅ All required env vars present
```

### 2. Test Database Connection
```bash
npm run verify:db
```

**Expected output**:
```
✅ Profiles table - OK
✅ Posts table - OK
✅ Listings table - OK
...
✅ Database verification complete
```

### 3. Start Development Server
```bash
npm run dev
```

**Expected**:
- Server starts on http://localhost:3000
- No errors about missing environment variables

### 4. Check Health Endpoint
```bash
curl http://localhost:3000/api/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "checks": {
    "supabase": "healthy",
    "environment": "healthy"
  }
}
```

---

## 🚨 Troubleshooting

### Issue: "Missing environment variables"

**Fix**:
1. Make sure file is named `.env.local` (not `.env`)
2. Make sure file is in project root (same folder as package.json)
3. Restart your dev server after editing
4. Run `npm run verify:env`

### Issue: "Cannot connect to database"

**Fix**:
1. Check DATABASE_URL format is correct
2. Verify your database password
3. Ensure your Supabase project is active
4. Test connection with Prisma Studio:
   ```bash
   npm run prisma:studio
   ```

### Issue: "Stripe is not defined"

**Fix**:
1. Check Stripe is installed:
   ```bash
   npm list stripe
   ```
2. If not installed:
   ```bash
   npm install stripe
   ```

### Issue: "Health check returns 'unhealthy'"

**Fix**:
1. Check which service is unhealthy in the response
2. Fix that specific service:
   - **supabase**: Check NEXT_PUBLIC_SUPABASE_* variables
   - **environment**: Check required variables exist
   - **stripe**: Check STRIPE_SECRET_KEY (optional)

---

## 📞 Quick Help

### Run the Setup Wizard
```bash
node scripts/setup-env.js
```

### Verify Everything Works
```bash
npm run verify:all
```

### Start Developing
```bash
npm run dev
```

### Check System Health
```bash
curl http://localhost:3000/api/health
```

---

## ✨ What Happens After Setup

Once your environment is configured:

1. ✅ App runs on http://localhost:3000
2. ✅ You can create accounts at `/auth`
3. ✅ All features work (shopping, bookings, social)
4. ✅ Payment testing works (with Stripe test cards)
5. ✅ Admin dashboard accessible at `/admin`

---

## 🎯 Next Steps After Environment Setup

1. **Test the app**:
   ```bash
   npm run dev
   ```

2. **Create admin account**:
   - Sign up at http://localhost:3000/auth
   - Add your email to `src/lib/admin.ts` OR
   - Update in database:
     ```sql
     UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
     ```

3. **Read the guides**:
   - [USER_GUIDE.md](./USER_GUIDE.md) - Learn all features
   - [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) - Admin operations

4. **Start developing**:
   - [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
   - [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference

---

**Need help?** Check [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for all guides!

---

**Status**: ⚠️ Waiting for environment configuration  
**Next Command**: `node scripts/setup-env.js`  
**Time to Complete**: 5-10 minutes

