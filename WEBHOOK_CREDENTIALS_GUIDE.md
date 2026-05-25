# 🔐 STRIPE WEBHOOK - GET YOUR CREDENTIALS

**Quick Guide to Get Your Webhook Secret**  
**Time: 5 minutes**

---

## 🎯 **WHAT YOU NEED**

You need to get your **Webhook Signing Secret** from Stripe and add it to your `.env` file.

**Current Status:**
- ✅ Stripe Account: Connected (`optimix sandbox`)
- ✅ Stripe Keys: Set in `.env`
- ⚠️ Webhook Secret: `whsec_YOUR_WEBHOOK_SECRET` (placeholder)

---

## 🚀 **EASIEST METHOD: Use Stripe CLI for Local Testing**

This is the fastest way to get started and test webhooks locally.

### Step 1: Install Stripe CLI

**Windows PowerShell (as Administrator):**

```powershell
# Option A: Using Scoop (Recommended)
# Install Scoop first if you don't have it:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Then install Stripe:
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Option B: Using Chocolatey
choco install stripe-cli

# Option C: Manual Download
# Go to: https://github.com/stripe/stripe-cli/releases
# Download: stripe_X.X.X_windows_x86_64.zip
# Extract to C:\stripe\
# Add C:\stripe\ to your PATH
```

### Step 2: Login to Stripe

```bash
stripe login
```

**What happens:**
1. Browser opens with Stripe login
2. Click "Allow access"
3. Terminal shows: "Done! The Stripe CLI is configured..."

### Step 3: Start Webhook Forwarding

```bash
# Run this command and KEEP IT RUNNING in a terminal
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**You'll see output like:**
```
> Ready! You are using Stripe API Version [2025-10-29]. This version can be configured in...
> Your webhook signing secret is whsec_abc123xyz456...
```

### Step 4: Copy Your Webhook Secret

**Copy the `whsec_...` value** from the terminal output above.

### Step 5: Update Your `.env` File

1. Open `.env` file in your project root
2. Find this line:
```env
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

3. Replace with your actual secret:
```env
STRIPE_WEBHOOK_SECRET=whsec_abc123xyz456...
```

4. **Save the file**

### Step 6: Restart Your Dev Server

```powershell
# Stop current server (Ctrl+C)
# Then start again:
npm run dev
```

### ✅ **Done! Your webhook is ready for local testing!**

---

## 🧪 **TEST YOUR WEBHOOK**

### Test 1: Trigger Test Event

**In a NEW terminal** (keep stripe listen running):

```bash
stripe trigger payment_intent.succeeded
```

**Expected Output:**
```
✓ Triggered payment_intent.succeeded [evt_test_...]
```

**Check your first terminal (stripe listen):**
```
[200] POST http://localhost:3000/api/webhooks/stripe [evt_test_...]
```

✅ **If you see [200], webhook is working!**

### Test 2: Check Database

**In Supabase Dashboard → SQL Editor:**

```sql
SELECT * FROM webhook_logs 
WHERE source = 'stripe' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Should show:**
- Event type: `payment_intent.succeeded`
- Status: `success`
- Payload: {...}
- Created at: Recent timestamp

✅ **If you see entries, webhooks are being logged!**

### Test 3: Create Real Payment

1. **Start dev server** (`npm run dev`)
2. **Keep stripe listen running**
3. **Open browser:** http://localhost:3000
4. **Login/Register**
5. **Add item to cart**
6. **Go to checkout**
7. **Use test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
8. **Complete payment**

**Expected:**
- ✅ Payment succeeds
- ✅ Webhook received (check stripe listen terminal)
- ✅ Order status = "paid" (check database)
- ✅ Notification created (check notifications table)

---

## 🌐 **PRODUCTION METHOD: Stripe Dashboard**

For when you deploy to production (Vercel, Netlify, etc.):

### Step 1: Deploy Your App First
- Deploy to Vercel/Netlify/your hosting
- Get your production URL (e.g., `https://optimix.vercel.app`)

### Step 2: Create Webhook in Stripe Dashboard

1. **Go to:** https://dashboard.stripe.com
2. **Switch to Test Mode** (toggle in top right)
3. **Navigate:** Developers → Webhooks
4. **Click:** "Add endpoint" button

**Configure:**
- **Endpoint URL:** `https://your-domain.com/api/webhooks/stripe`
  - Example: `https://optimix.vercel.app/api/webhooks/stripe`
- **Description:** "Optimix Payment Webhooks"
- **Events to send:** Click "Select events", then choose:
  - ✅ `payment_intent.succeeded`
  - ✅ `payment_intent.payment_failed`
  - ✅ `payment_intent.canceled`
  - ✅ `charge.refunded`
- **Click:** "Add endpoint"

### Step 3: Get Production Secret

1. Click on your newly created webhook
2. Find **"Signing secret"** section
3. Click **"Reveal"** or the eye icon
4. Copy the value (starts with `whsec_`)

### Step 4: Add to Production Environment

**Vercel:**
1. Project Settings → Environment Variables
2. Add: `STRIPE_WEBHOOK_SECRET` = `whsec_...`
3. Redeploy

**Netlify:**
1. Site Settings → Build & Deploy → Environment
2. Add: `STRIPE_WEBHOOK_SECRET` = `whsec_...`
3. Redeploy

**Other Hosting:**
- Add to your production `.env` file
- Restart your production server

---

## 🔑 **YOUR CREDENTIALS REFERENCE**

Save this information:

### Stripe Account
- **Account ID:** `acct_1RfVl24FDZYCNCWY`
- **Account Name:** optimix sandbox
- **Mode:** Test Mode (use test cards)

### Webhook Endpoints

**Local Development:**
```
URL: http://localhost:3000/api/webhooks/stripe
Method: Use Stripe CLI
Secret: whsec_... (from stripe listen command)
```

**Production:**
```
URL: https://your-domain.com/api/webhooks/stripe
Method: Stripe Dashboard
Secret: whsec_... (from Stripe Dashboard)
```

### Events Configured
1. ✅ `payment_intent.succeeded` - Payment completed
2. ✅ `payment_intent.payment_failed` - Payment failed
3. ✅ `payment_intent.canceled` - Payment canceled
4. ✅ `charge.refunded` - Refund processed

### Test Cards
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Insufficient funds:** `4000 0000 0000 9995`
- **Expiry:** Any future date
- **CVC:** Any 3 digits

---

## 🐛 **TROUBLESHOOTING**

### "stripe: command not found"

**Solution:**
```powershell
# Check if installed
where.exe stripe

# If not found, install using Scoop:
scoop install stripe

# Or download manually from:
# https://github.com/stripe/stripe-cli/releases/latest
```

### "Authentication required"

**Solution:**
```bash
# Login to Stripe
stripe login

# Follow browser prompt
```

### "Ready! Your webhook signing secret is..."

**This is SUCCESS!** Copy that secret to your `.env` file.

### Webhook returns 400 "Webhook Error: ..."

**Solution:**
- Wrong secret in `.env`
- Restart dev server after changing `.env`
- Verify no spaces before/after secret value

### Events not being logged

**Solution:**
```sql
-- Check if webhook_logs table exists
SELECT * FROM webhook_logs LIMIT 1;

-- If table doesn't exist, see CRITICAL_FIXES_GUIDE.md
```

---

## ✅ **VERIFICATION CHECKLIST**

After setup, verify:

- [ ] Stripe CLI installed (`stripe --version`)
- [ ] Logged in to Stripe (`stripe login`)
- [ ] Webhook forwarding running (`stripe listen...`)
- [ ] Webhook secret copied to `.env`
- [ ] Dev server restarted
- [ ] Test event triggered (`stripe trigger...`)
- [ ] Webhook received (check logs)
- [ ] Database updated (check webhook_logs)

---

## 🎊 **SUCCESS CRITERIA**

You'll know it's working when:

1. ✅ `stripe listen` shows `[200] POST http://localhost:3000/api/webhooks/stripe`
2. ✅ Terminal shows "Payment succeeded for order..."
3. ✅ `webhook_logs` table has new entries
4. ✅ `notifications` table has new payment notifications
5. ✅ Order status updates from "pending" to "paid"

---

## 📞 **NEED HELP?**

### Quick Help
- **Stripe CLI Issues:** https://stripe.com/docs/stripe-cli
- **Webhook Issues:** https://stripe.com/docs/webhooks
- **Test Cards:** https://stripe.com/docs/testing

### Your Documentation
- `STRIPE_WEBHOOK_SETUP.md` - Full detailed guide
- `TEST_SUITE.md` - All test procedures
- `CRITICAL_FIXES_GUIDE.md` - Complete fix guide
- `PROJECT_AUDIT_REPORT.md` - Full system audit

---

## 🎁 **BONUS: Useful Stripe CLI Commands**

```bash
# Login
stripe login

# List webhooks
stripe webhooks list

# View recent events
stripe events list --limit 10

# Trigger specific events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded

# View logs
stripe logs tail

# Get account info
stripe accounts get

# View customers
stripe customers list
```

---

## 🚀 **NEXT STEPS**

1. **Install Stripe CLI** (5 min)
2. **Run `stripe listen`** (1 min)
3. **Copy webhook secret** (1 min)
4. **Update `.env`** (1 min)
5. **Restart server** (1 min)
6. **Test with `stripe trigger`** (1 min)
7. **Verify in database** (1 min)

**Total Time: ~10 minutes to full webhook functionality!**

---

*You're almost there! Just this one last setup step and you're 100% production-ready!* 🎉

