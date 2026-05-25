# 🚨 CRITICAL FIXES GUIDE

**Last Updated:** November 12, 2024  
**Priority:** IMMEDIATE ACTION REQUIRED

---

## 🔴 Fix #1: Database Schema Mismatch (CRITICAL)

### Problem
Your Prisma schema doesn't match your actual Supabase database. This causes runtime errors.

### Solution A: Pull Schema from Supabase (Recommended)

```bash
# 1. Backup current Prisma schema
cp prisma/schema.prisma prisma/schema.prisma.backup

# 2. Pull schema from Supabase
npx prisma db pull

# 3. Review changes
# Compare schema.prisma with schema.prisma.backup

# 4. Generate Prisma Client
npx prisma generate

# 5. Test the application
npm run dev
```

### Solution B: Push Prisma Schema to Supabase

```bash
# WARNING: This will modify your Supabase database!
# Only use if you want Prisma to be the source of truth

# 1. Backup your Supabase database first!
# Use Supabase Dashboard → Database → Backups

# 2. Push schema
npx prisma db push

# 3. Generate Prisma Client
npx prisma generate
```

### Verification
Run this test to verify schema is working:

```bash
# In your terminal
npm run dev

# In another terminal
curl http://localhost:3000/api/health

# Should return status: "healthy" for all checks
```

---

## 🔴 Fix #2: Notification Schema Mismatch

### Problem
Code tries to insert `title` and `message` fields into notifications table, but table only has `type`, `data`, `read`, `user_id`.

### Files to Update

1. **app/api/webhooks/stripe/route.ts** (Lines 156-164, 204-211, 270-277)

**Before:**
```typescript
await supabaseAdmin
  .from('notifications')
  .insert({
    user_id: order.buyer,
    type: 'payment_success',
    title: 'Payment Successful',
    message: `Your payment of $${Number(order.total).toFixed(2)} has been processed.`,
    data: { orderId, paymentIntentId: paymentIntent.id }
  })
```

**After:**
```typescript
await supabaseAdmin
  .from('notifications')
  .insert({
    user_id: order.buyer,
    type: 'payment_success',
    data: { 
      orderId, 
      paymentIntentId: paymentIntent.id,
      title: 'Payment Successful',
      message: `Your payment of $${Number(order.total).toFixed(2)} has been processed.`
    }
  })
```

2. **app/api/bookings/create/route.ts** (Line 176-182)

**Before:**
```typescript
await supabase
  .from('notifications')
  .insert({
    user_id: listing.vendor,
    type: 'new_booking',
    title: 'New Booking Request',
    message: `You have a new booking request for ${days} day(s).`,
    data: { bookingId: booking.id, listingId: listing_id }
  })
```

**After:**
```typescript
await supabase
  .from('notifications')
  .insert({
    user_id: listing.vendor,
    type: 'new_booking',
    data: { 
      bookingId: booking.id, 
      listingId: listing_id,
      title: 'New Booking Request',
      message: `You have a new booking request for ${days} day(s).`
    }
  })
```

3. **app/api/bookings/update/route.ts** (Lines 171-180)

Apply same pattern - move `title` and `message` into `data` object.

4. **app/api/vendor/verify/route.ts** (Lines 136-146, 155-162)

Apply same pattern - move `title` and `message` into `data` object.

5. **app/api/gamification/update/route.ts** (Lines 249-257)

Apply same pattern - move `title` and `message` into `data` object.

### Quick Fix Script

Create a file `scripts/fix-notifications.sh`:

```bash
#!/bin/bash

# This script updates notification inserts across the codebase
# Run from project root: bash scripts/fix-notifications.sh

echo "Fixing notification inserts..."

# Create backup
cp -r app/api app/api.backup

# Note: Manual review required - automated replacement may be error-prone
echo "⚠️  Please manually update notification inserts as per CRITICAL_FIXES_GUIDE.md"
echo "✅ Backup created at app/api.backup"
```

---

## 🔴 Fix #3: Set Stripe Webhook Secret

### Problem
Webhook secret is set to placeholder value `whsec_YOUR_WEBHOOK_SECRET`

### Steps

1. **Go to Stripe Dashboard**
   - https://dashboard.stripe.com
   - Switch to Test mode (toggle in top right)

2. **Navigate to Webhooks**
   - Developers → Webhooks

3. **Add Endpoint**
   - Click "Add endpoint"
   - **Endpoint URL:** `https://your-domain.com/api/webhooks/stripe`
     - For testing: use `ngrok` to expose localhost
   - **Events to send:**
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `charge.refunded`
   - Click "Add endpoint"

4. **Copy Signing Secret**
   - Click on the newly created webhook
   - Click "Reveal" under "Signing secret"
   - Copy the value (starts with `whsec_`)

5. **Update Environment Variable**

**File:** `.env.local` (at the ROOT of your project, or use the template env.example.txt)

```env
STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
```

6. **Restart Your Development Server**

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Testing Webhook Locally

```bash
# Install Stripe CLI
# Windows (using Scoop)
scoop install stripe

# Or download from: https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, trigger a test event
stripe trigger payment_intent.succeeded
```

---

## 🔴 Fix #4: Implement Production Rate Limiting

### Problem
Current rate limiting uses in-memory Map, won't work in serverless environments.

### Solution: Use Vercel KV (Recommended for Vercel deployments)

1. **Install Vercel KV**

```bash
npm install @vercel/kv
```

2. **Update middleware.ts**

**Before:**
```typescript
// In-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
```

**After:**
```typescript
import { kv } from '@vercel/kv'

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `rate-limit:${ip}`
  const now = Date.now()
  
  const data = await kv.get<{ count: number; resetTime: number }>(key)
  
  if (!data) {
    await kv.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW }, { px: RATE_LIMIT_WINDOW })
    return true
  }
  
  if (now > data.resetTime) {
    await kv.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW }, { px: RATE_LIMIT_WINDOW })
    return true
  }
  
  if (data.count >= MAX_REQUESTS) {
    return false
  }
  
  await kv.set(key, { count: data.count + 1, resetTime: data.resetTime }, { px: data.resetTime - now })
  return true
}
```

3. **Set up Vercel KV**

```bash
# In Vercel Dashboard
# 1. Go to Storage tab
# 2. Create KV Database
# 3. Connect to your project
# 4. Environment variables will be automatically added
```

---

## 🟡 Fix #5: Update Gamification API

### Problem
References non-existent tables `points_history` and `credits_history`

### Solution

**File:** `app/api/gamification/update/route.ts`

**Lines 147-155 - Update points_history to user_points:**

**Before:**
```typescript
const { error: historyError } = await adminClient
  .from('points_history')
  .insert({
    user_id: userId,
    points: pointsToAdd,
    action: action,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  })
```

**After:**
```typescript
const { error: historyError } = await adminClient
  .from('user_points')
  .insert({
    user_id: userId,
    points: pointsToAdd,
    reason: action,
    metadata: metadata || {},
    awarded_at: new Date().toISOString(),
  })
```

**Lines 171-181 - Update credits_history similarly:**

**Before:**
```typescript
await adminClient
  .from('credits_history')
  .insert({
    user_id: userId,
    credits: creditsToAdd,
    action: 'purchase_reward',
    metadata: metadata,
    created_at: new Date().toISOString(),
  })
```

**After:**
```typescript
// Store credits in metadata of user_points
await adminClient
  .from('user_points')
  .insert({
    user_id: userId,
    points: 0, // No points, just tracking credits
    reason: 'purchase_reward_credits',
    metadata: { ...metadata, credits: creditsToAdd },
    awarded_at: new Date().toISOString(),
  })
```

---

## 📋 VERIFICATION CHECKLIST

After applying all fixes, verify:

- [ ] Schema pulled/pushed successfully
- [ ] `npx prisma generate` runs without errors
- [ ] App starts without errors: `npm run dev`
- [ ] Health endpoint returns healthy: `curl http://localhost:3000/api/health`
- [ ] Notifications can be created without errors
- [ ] Stripe webhook secret is set (check `.env.local`)
- [ ] Test webhook with Stripe CLI
- [ ] Gamification API uses correct table names
- [ ] Rate limiting is working (make 101 requests to see 429)

---

## 🆘 TROUBLESHOOTING

### Prisma Pull Fails

```bash
# Check DATABASE_URL is correct
echo $DATABASE_URL

# Verify Supabase connection
npx prisma db pull --print
```

### Webhook Events Not Received

```bash
# Check webhook secret is set
grep STRIPE_WEBHOOK_SECRET .env.local

# Test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Notifications Still Failing

```sql
-- Check notification table schema in Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications';
```

### Import Errors After Schema Change

```bash
# Clear Next.js cache
rm -rf .next

# Regenerate Prisma client
npx prisma generate

# Restart dev server
npm run dev
```

---

## 🎯 SUCCESS CRITERIA

You'll know fixes are successful when:

1. ✅ No TypeScript errors in terminal
2. ✅ Health check shows all systems healthy
3. ✅ Test payment completes successfully
4. ✅ Webhook events logged in Supabase `webhook_logs` table
5. ✅ Notifications appear in user's notification center
6. ✅ Points are awarded and recorded correctly

---

## 📞 NEED HELP?

If you encounter issues:

1. **Check logs:**
   ```bash
   # Terminal logs
   npm run dev
   
   # Supabase logs
   # Dashboard → Logs
   
   # Stripe logs
   # Dashboard → Developers → Logs
   ```

2. **Review Documentation:**
   - `PROJECT_AUDIT_REPORT.md` - Full audit
   - `PRISMA_SETUP.md` - Database setup
   - `ENV_SETUP.md` - Environment variables

3. **Test Individually:**
   - Test each API route separately
   - Use Postman or `curl` for API testing
   - Check Supabase SQL editor for manual queries

---

*Last Updated: November 12, 2024*
*Priority: 🔴 CRITICAL - Apply immediately before deployment*

