# Environment Variables Setup Guide

## Required Environment Variables

Create a `.env.local` file in the root directory (`my-app/.env.local`) with the following variables:

```env
# ============================================
# SUPABASE CONFIGURATION (Required)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# DATABASE (Required for Prisma)
# ============================================
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# ============================================
# OPTIONAL: STRIPE
# ============================================
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key

# ============================================
# OPTIONAL: PUSH NOTIFICATIONS
# ============================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key

# ============================================
# OPTIONAL: ERROR TRACKING
# ============================================
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_ERROR_TRACKING_SERVICE=console

# ============================================
# OPTIONAL: APP CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_NAME=Optimix
```

## How to Get Your Supabase Credentials

### 1. Get Supabase URL and Anon Key

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Get Database Connection String

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Select **URI** tab
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your database password
6. Use this as `DATABASE_URL`

**Format:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

**To find your database password:**
- If you set it during project creation, use that password
- If you forgot it, you can reset it in **Settings** → **Database** → **Database password**

### 3. Optional: Stripe Public Key

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
4. Use as `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`

### 4. Optional: VAPID Public Key (Push Notifications)

1. Generate VAPID keys using a tool like [web-push](https://github.com/web-push-libs/web-push)
2. Or use Supabase's built-in push notification service
3. Copy the public key to `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

## File Location

Create the file at:
```
my-app/.env.local
```

**Important**: 
- `.env.local` is gitignored by default (should not be committed)
- Never commit sensitive keys to version control
- Use different keys for development and production

## Verification

After setting up environment variables:

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Check console for warnings**:
   - If you see warnings about missing env vars, double-check your `.env.local` file
   - Make sure variable names match exactly (case-sensitive)

3. **Test Supabase connection**:
   - Try signing up/logging in
   - Check browser console for any connection errors

4. **Test Prisma connection**:
   ```bash
   npx prisma migrate status
   ```
   - Should connect successfully (may show migration status)

## Troubleshooting

### "Missing Supabase environment variables" warning

- Check that `.env.local` exists in the root directory
- Verify variable names start with `NEXT_PUBLIC_` for client-side variables
- Restart the dev server after adding/updating env vars

### Prisma authentication errors

- Verify `DATABASE_URL` format is correct
- Check that database password is correct
- Ensure connection string uses correct project reference
- Try using connection pooling URL instead

### Environment variables not loading

- Make sure file is named `.env.local` (not `.env` or `.env.local.txt`)
- Restart the dev server
- Clear Next.js cache: `rm -rf .next` then restart

## Security Notes

- ✅ `.env.local` is automatically gitignored
- ✅ Never commit `.env.local` to version control
- ✅ Use different keys for development and production
- ✅ Rotate keys if they're accidentally exposed
- ✅ Use environment-specific files:
  - `.env.local` - Local development (gitignored)
  - `.env.production` - Production (gitignored)
  - `.env.example` - Template (can be committed)

