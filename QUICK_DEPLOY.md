# 🚀 Quick Start: Deploy Your Optimix Platform

## ✅ **PRE-DEPLOYMENT CHECKLIST**

### 1. Apply Database Migration (5 minutes)

**This is CRITICAL - do this first!**

1. Open: https://supabase.com/dashboard/project/ofzehffrqzvxlnbaxxby/sql
2. Copy and paste this SQL:

```sql
-- Add onboarding_completed field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Set existing users as having completed onboarding
UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE (username IS NOT NULL AND username != '') 
   OR (display_name IS NOT NULL AND display_name != '');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON public.profiles(onboarding_completed);
```

3. Click **Run**
4. Should see: "Success. No rows returned"

---

### 2. Test Locally (10 minutes)

```powershell
# Build the app
npm run build

# Start production server
npm start

# Open browser
# http://localhost:3000
```

**Test these flows:**
1. ✅ Create account → See onboarding
2. ✅ Complete onboarding → Redirect to /home
3. ✅ Log out, log back in → Skip onboarding (go to /home)
4. ✅ Create a post → Earn 5 points
5. ✅ Like your post → See like count increase

---

### 3. Deploy to Vercel (15 minutes)

```powershell
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

**When prompted:**
- Set up new project? → Yes
- Link to existing? → No
- Project name → optimix
- Framework → Next.js
- Build command → `npm run build`

**Add Environment Variables:**

Vercel will ask you to add these. Copy from `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ofzehffrqzvxlnbaxxby.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://noble-shepherd-38765.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaOdAAI...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dzzlg10kq
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...ingest.us.sentry.io/...

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-933NJ91QRT
```

---

### 4. Configure Webhooks (5 minutes)

**Clerk Webhook:**
1. Go to: https://dashboard.clerk.com/apps/app_2sK3qL7jvmF74pNFbbm3wWV3v7k/webhooks
2. Click "Add Endpoint"
3. Endpoint URL: `https://YOUR_VERCEL_URL.vercel.app/api/webhooks/clerk`
4. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy webhook secret → Update `CLERK_WEBHOOK_SECRET` in Vercel

**Stripe Webhook:**
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://YOUR_VERCEL_URL.vercel.app/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy webhook secret → Update `STRIPE_WEBHOOK_SECRET` in Vercel

---

### 5. Update App URL (2 minutes)

**In Vercel environment variables:**

```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**In Clerk dashboard:**
- Update redirect URLs to include your production domain

---

## 🎯 **POST-DEPLOYMENT TESTING**

### Test All Workflows

#### **1. User Registration & Onboarding**
```
✅ Sign up new account
✅ See onboarding screen
✅ Complete onboarding → Get 50 credits + 10 points
✅ See Welcome badge
✅ Redirect to /home
✅ Log out, log back in → Go directly to /home
```

#### **2. Social Features**
```
✅ Create post → Earn 5 points
✅ Upload image to post
✅ Like post → Post author earns 1 point
✅ Comment on post → Earn 2 points
✅ Follow user → Earn 3 points
✅ Unfollow user
✅ View followers list
```

#### **3. Marketplace**
```
✅ Browse marketplace
✅ Search for products
✅ Add to cart
✅ Checkout with Stripe (use test card: 4242 4242 4242 4242)
✅ See order confirmation
✅ Earn 10 points + credits from purchase
```

#### **4. Vendor Features**
```
✅ Apply to become vendor
✅ Admin approves vendor
✅ Create listing
✅ Earn 10 points for listing
✅ View vendor dashboard
✅ See orders (if any)
```

#### **5. Gamification**
```
✅ View points on profile
✅ Check badge collection
✅ Earn points from multiple actions
✅ Unlock "Member" badge at 50 points
✅ Unlock "Bronze Member" at 100 points
```

---

## ⚙️ **OPTIONAL ENHANCEMENTS**

### Enable Email Notifications (Optional)

1. Sign up for Resend: https://resend.com
2. Add to `.env.local` and Vercel:
```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### Enable Push Notifications (Optional)

1. Generate VAPID keys: https://web-push-codelab.glitch.me/
2. Add to `.env.local` and Vercel:
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_key
VAPID_PRIVATE_KEY=your_key
```

---

## 🐛 **TROUBLESHOOTING**

### "User stuck in onboarding loop"
→ Run the migration SQL in Supabase (step 1 above)

### "Webhook not receiving events"
→ Check webhook URLs in Clerk/Stripe dashboards match your production URL

### "Images not uploading"
→ Check Cloudinary credentials in environment variables

### "Points not being awarded"
→ Check Supabase logs → SQL tab → See if triggers are active

### "Build failing on Vercel"
→ Check build logs → Usually TypeScript errors
→ Run `npm run build` locally first to catch errors

---

## 📊 **MONITORING**

### Check System Health

**Vercel:**
- Deployment logs: https://vercel.com/dashboard
- Function logs: See each function's execution

**Supabase:**
- Database logs: https://supabase.com/dashboard/project/ofzehffrqzvxlnbaxxby/logs/database-logs
- Realtime logs: Check connection counts

**Sentry:**
- Error tracking: https://optimixhub.sentry.io
- Performance monitoring

**Stripe:**
- Payment logs: https://dashboard.stripe.com/test/payments
- Webhook events: Check delivery status

---

## 🎉 **YOU'RE LIVE!**

Your Optimix platform is now deployed and fully operational with:

✅ Social feed with posts, comments, likes
✅ Follow/unfollow system
✅ Marketplace with Stripe payments
✅ Vendor dashboards
✅ Gamification (points, badges, credits)
✅ Real-time updates
✅ Onboarding tracking
✅ Admin panel
✅ Error monitoring
✅ Rate limiting

**Next Steps:**
1. Invite beta testers
2. Gather feedback
3. Monitor Sentry for errors
4. Check analytics in Google Analytics
5. Optimize based on user behavior

---

**Need Help?**
- Documentation: See `SYSTEM_CAPABILITIES_AUDIT.md`
- API Reference: See `API_DOCUMENTATION_COMPLETE.md`
- User Guide: See `USER_GUIDE.md`
- Admin Guide: See `ADMIN_GUIDE.md`

**Good luck! 🚀**
