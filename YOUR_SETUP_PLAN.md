# 🎯 YOUR PERSONALIZED SETUP PLAN

**Based on your answers - Let's get you running immediately!**

**Admin**: ddabney23@gmail.com  
**Timeline**: Immediate deployment  
**Features**: All enabled (Stripe, emails, push, analytics)

---

## 🚀 STEP-BY-STEP SETUP (Follow in Order)

### STEP 1: Install & Setup Supabase CLI (3 min)

```bash
# Install Supabase CLI globally
npm install -g supabase

# Login to Supabase
supabase login
```

**This will:**
- Open browser for authentication
- Connect your terminal to Supabase

---

### STEP 2: Link Your Project (2 min)

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

**How to find YOUR_PROJECT_REF:**
1. Go to https://app.supabase.com
2. Select your project
3. Look at the URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`
4. OR: Settings → General → Reference ID

**Example:**
```bash
supabase link --project-ref abcdefghijklmnop
```

---

### STEP 3: Push All Migrations (3 min)

```bash
# Push all 20 migrations to your database
supabase db push
```

**This will:**
- Apply all 20 SQL files in `supabase/migrations/`
- Create all tables (profiles, posts, listings, orders, etc.)
- Set up RLS policies
- Configure triggers and functions

**Expected output:**
```
Applying migration 001_init_schema.sql...
Applying migration 002_rls_policies.sql...
...
Applying migration 020_...
✓ All migrations applied successfully
```

---

### STEP 4: Generate VAPID Keys for Push Notifications (1 min)

```bash
# Generate VAPID keys for push notifications
npx web-push generate-vapid-keys
```

**Save the output!** You'll get:
```
Public Key: BN...
Private Key: ...
```

**Copy both keys** - you'll need them for .env.local

---

### STEP 5: Set Up Admin Access (1 min)

I'll create a SQL script to make ddabney23@gmail.com an admin:

```sql
-- Run this in Supabase SQL Editor after you create your account
UPDATE profiles 
SET is_admin = true 
WHERE email = 'ddabney23@gmail.com';
```

**Or I can add to the whitelist file directly!**

---

### STEP 6: Gather All Your API Keys (5 min)

You'll need to collect these:

#### A. Supabase Keys (Required)
1. Go to https://app.supabase.com → Your Project
2. Settings → API
3. Copy:
   - **Project URL** (looks like: https://xyz.supabase.co)
   - **anon/public key** (starts with: eyJhbG...)

4. Settings → Database
5. Copy **Connection string** (URI format)
6. Replace `[YOUR-PASSWORD]` with your database password

#### B. Stripe Keys (Required - you said YES)
1. Go to https://dashboard.stripe.com
2. **Stay in Test Mode** (for now)
3. Developers → API keys
4. Copy:
   - **Publishable key** (pk_test_...)
   - **Secret key** (sk_test_...)

#### C. Email Service (Required - you said YES)
Choose one:
- **Resend**: https://resend.com → Get API key
- **SendGrid**: https://sendgrid.com → Get API key

#### D. Google Analytics (Required - you said YES)
1. Go to https://analytics.google.com
2. Create property for "Optimix"
3. Copy Measurement ID (G-XXXXXXXXXX)

---

### STEP 7: Create .env.local File (3 min)

I'll create a personalized template for you. Run:

```bash
node scripts/setup-env.js
```

**OR create `.env.local` manually** with this content:

```env
# ============================================
# SUPABASE (Required)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# ============================================
# APP CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_NAME=Optimix
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# STRIPE (You said YES)
# ============================================
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET

# ============================================
# EMAIL SERVICE (You said YES)
# ============================================
RESEND_API_KEY=re_YOUR_KEY
FROM_EMAIL=noreply@optimix.com

# ============================================
# PUSH NOTIFICATIONS (You said YES)
# ============================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY_FROM_STEP_4
VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY_FROM_STEP_4

# ============================================
# ANALYTICS (You said YES)
# ============================================
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX

# ============================================
# ADMIN & MISC
# ============================================
NEXT_PUBLIC_2FA_SERVICE_NAME=Optimix
NODE_ENV=development
```

**Replace all YOUR_* placeholders with actual values!**

---

### STEP 8: Verify Everything Works (2 min)

```bash
# Verify environment variables
npm run verify:env

# Verify database tables
npm run verify:db

# Or check both
npm run verify:all
```

**Expected output:**
```
✅ All required env vars present
✅ Profiles table - OK
✅ Posts table - OK
✅ Listings table - OK
...
✅ Database verification complete
```

---

### STEP 9: Start Development Server (1 min)

```bash
npm run dev
```

**Visit**: http://localhost:3000

**You should see:**
- ✅ Homepage loads
- ✅ No errors in console
- ✅ Can click "Sign Up" or "Login"

---

### STEP 10: Create Your Admin Account (2 min)

1. Go to http://localhost:3000/auth
2. Sign up with: **ddabney23@gmail.com**
3. Complete onboarding
4. Go to http://localhost:3000/admin
5. You should see the admin dashboard! 🎉

---

## 🔐 ADMIN ACCESS SETUP

I'll update the admin whitelist for you:

**File to update**: `src/lib/admin.ts`

I'll add your email: ddabney23@gmail.com

This gives you instant admin access without needing to update the database!

---

## 📦 QUICK COMMAND REFERENCE

```bash
# Supabase CLI Setup
npm install -g supabase
supabase login
supabase link --project-ref YOUR_REF
supabase db push

# Generate VAPID keys
npx web-push generate-vapid-keys

# Verify setup
npm run verify:all

# Start app
npm run dev

# View database
npm run prisma:studio
```

---

## 🆘 TROUBLESHOOTING

### "supabase command not found"
```bash
# Make sure it's installed globally
npm install -g supabase

# Check version
supabase --version
```

### "Failed to push migrations"
- Make sure you're linked to correct project
- Check your database password is correct
- Try applying via SQL Editor instead (Option A from earlier)

### "Cannot connect to database"
- Verify DATABASE_URL in .env.local
- Check password has no special characters (or URL encode them)
- Test with: `npm run prisma:studio`

---

## ⏱️ TIME ESTIMATE

- **STEP 1-3**: Supabase CLI (8 min)
- **STEP 4**: VAPID keys (1 min)
- **STEP 5**: Admin setup (1 min)
- **STEP 6**: Gather API keys (5 min)
- **STEP 7**: Create .env.local (3 min)
- **STEP 8**: Verify (2 min)
- **STEP 9-10**: Start & test (3 min)

**Total: ~23 minutes to fully running app!**

---

## 🎯 LET'S START NOW!

**Run these commands one by one:**

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link (replace YOUR_REF)
supabase link --project-ref YOUR_REF

# 4. Apply migrations
supabase db push

# 5. Generate VAPID keys
npx web-push generate-vapid-keys
```

**Tell me after each step if you encounter any issues!**

---

**Status**: Ready to execute  
**Time**: 23 minutes total  
**Next**: Run the first command above! 🚀

