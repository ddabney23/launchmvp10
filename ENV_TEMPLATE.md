# Environment Variables Setup Guide

## Quick Setup

Create a `.env.local` file in the root directory with the following variables:

```env
# ============================================
# REQUIRED - SUPABASE CONFIGURATION
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# ============================================
# REQUIRED - SUPABASE AUTH (service role for admin API / migrations)
# ============================================
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# Database password for CLI migrations (Dashboard → Database → reset password)
SUPABASE_DB_PASSWORD=your_database_password_here

# Configure in Supabase Dashboard → Authentication:
# - Site URL: http://localhost:3000 (and production URL)
# - Redirect URLs: http://localhost:3000/auth/callback
# - Enable Email + Google OAuth providers

# ============================================
# REQUIRED - APPLICATION
# ============================================
NEXT_PUBLIC_APP_NAME=Optimix
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# PAYMENT INTEGRATION (Production Critical)
# ============================================
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# ============================================
# RATE LIMITING (Upstash Redis)
# ============================================
UPSTASH_REDIS_REST_URL=https://your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# ============================================
# OPTIONAL - MONITORING & ANALYTICS
# ============================================
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_GA_TRACKING_ID=your_google_analytics_id

# ============================================
# OPTIONAL - PUSH NOTIFICATIONS
# ============================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# ============================================
# OPTIONAL - EMAIL SERVICE
# ============================================
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@optimix.com

# ============================================
# OPTIONAL - 2FA
# ============================================
NEXT_PUBLIC_2FA_SERVICE_NAME=Optimix

# ============================================
# DEVELOPMENT
# ============================================
NEXT_PUBLIC_USE_MOCK_DATA=false
NODE_ENV=development
```

## How to Get Values

### Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database URL

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Copy the **Connection string** (URI format)
3. Replace `[YOUR-PASSWORD]` with your database password
4. Use as `DATABASE_URL`

### Stripe Keys (Required for Payments)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Test Mode** → **Developers** → **API Keys**
3. Copy:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`

### Stripe Webhook Secret

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Supabase Auth (Dashboard)

1. In Supabase Dashboard → **Authentication** → **Providers**, enable **Email** and **Google**
2. Set **Site URL** to `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)
3. Add **Redirect URLs**: `http://localhost:3000/auth/callback` and your production callback URL
4. Copy **service_role** key from **Settings** → **API** → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to the client)

### Migrating existing Clerk users (one-time)

After applying migration `048_supabase_auth_realign.sql`:

```bash
npm run migrate:clerk-users
```

Then apply `049_profiles_auth_fkey.sql`, `052_restore_profiles_rls.sql`, `053_fix_profiles_rls_recursion.sql`, and later `050_drop_clerk_user_id.sql` when all clients use `profiles.id` = `auth.users.id`.

If you see `infinite recursion detected in policy for relation "profiles"` in dev logs, run migration `053` in the Supabase SQL editor.

### Rate Limiting (Upstash Redis)

1. Create a database at [Upstash](https://upstash.com/)
2. Open the database → **REST API** tab
3. Copy `REST URL` and `REST TOKEN`
4. Add them to `.env.local` as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### VAPID Keys (Optional - for Push Notifications)

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

## Windows builds

See [docs/BUILD.md](docs/BUILD.md). Summary:

- **`npm run build`** auto-detects exFAT (e.g. external `O:`) and mirrors to `%LOCALAPPDATA%\optimix-mvp-build` (NTFS) because Next.js needs symlinks/junctions that exFAT does not support (`EISDIR` / `readlink` errors).
- **`npm run build:local`** always builds in the current folder (use on NTFS paths).
- Long-term: clone to `C:\dev\optimix-MVP1.0-beta` (NTFS, no spaces).

## Verification

After creating `.env.local`, verify your setup:

```bash
# Test database connection
npm run prisma:generate
npx prisma db pull

# Start development server
npm run dev
```

## Security Notes

- ⚠️ **NEVER commit `.env.local` to version control**
- ⚠️ Always use `NEXT_PUBLIC_` prefix for client-side variables
- ⚠️ Keep `STRIPE_SECRET_KEY` and `DATABASE_URL` server-side only
- ⚠️ Rotate all secrets before production deployment

