# 🔐 STRIPE WEBHOOK SETUP GUIDE

**Last Updated:** November 12, 2024  
**Time Required:** 10 minutes

---

## 📋 **WHAT YOU'LL GET**

After following this guide:
- ✅ Stripe webhook endpoint configured
- ✅ Webhook secret for your `.env` file
- ✅ Test events working locally
- ✅ Payment confirmations functioning

---

## 🚀 **STEP-BY-STEP SETUP**

### **Method 1: Production Webhook (For Deployed App)**

#### Step 1: Go to Stripe Dashboard
1. Visit: https://dashboard.stripe.com
2. **IMPORTANT:** Click the "Test mode" toggle in top right (should be ON)
3. You should see "Test mode" badge

#### Step 2: Navigate to Webhooks
1. In left sidebar, click **"Developers"**
2. Click **"Webhooks"** tab
3. Click **"Add endpoint"** button (blue button, top right)

#### Step 3: Configure Endpoint
**Endpoint URL:**
```
https://your-actual-domain.com/api/webhooks/stripe
```

**Examples:**
- Vercel: `https://optimix.vercel.app/api/webhooks/stripe`
- Netlify: `https://optimix.netlify.app/api/webhooks/stripe`
- Custom domain: `https://optimix.com/api/webhooks/stripe`

**DO NOT USE:**
- ❌ `http://localhost:3000/api/webhooks/stripe` (won't work for production)
- ❌ `127.0.0.1` or any local address

#### Step 4: Select Events to Listen For
Click **"Select events"** and choose these **4 events**:

1. ✅ `payment_intent.succeeded`
2. ✅ `payment_intent.payment_failed`
3. ✅ `payment_intent.canceled`
4. ✅ `charge.refunded`

**Quick Select:** Use search box to find each event

#### Step 5: Get Your Webhook Secret
1. Click **"Add endpoint"** button at bottom
2. You'll see your new webhook listed
3. Click on the webhook endpoint you just created
4. Find **"Signing secret"** section
5. Click **"Reveal"** (or click the eye icon)
6. Copy the value that starts with `whsec_`

**Example:**
```
whsec_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcd
```

#### Step 6: Update Your `.env` File
1. Open `.env` file in your project root
2. Find the line: `STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET`
3. Replace with your actual secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcd
```

4. Save the file
5. Restart your dev server (Ctrl+C, then `npm run dev`)

---

### **Method 2: Local Development Webhook (Testing on Localhost)**

For testing on your local machine, use Stripe CLI:

#### Step 1: Install Stripe CLI

**Windows (using Scoop):**
```powershell
# Install Scoop if you don't have it
iwr -useb get.scoop.sh | iex

# Install Stripe CLI
scoop install stripe
```

**Windows (using Chocolatey):**
```powershell
choco install stripe-cli
```

**Windows (Manual Download):**
1. Go to: https://github.com/stripe/stripe-cli/releases/latest
2. Download `stripe_X.X.X_windows_x86_64.zip`
3. Extract to `C:\stripe\`
4. Add `C:\stripe\` to your PATH

#### Step 2: Login to Stripe CLI
```bash
stripe login
```
- Browser window will open
- Click "Allow access"
- Return to terminal

#### Step 3: Forward Webhooks to Local Server
```bash
# Start forwarding (keep this running in a separate terminal)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**You'll see output like:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

#### Step 4: Copy the Local Webhook Secret
1. Copy the `whsec_` value from the terminal
2. Update your `.env` file:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```
3. Restart dev server

---

## ✅ **VERIFICATION CHECKLIST**

After setup, verify:

- [ ] Webhook endpoint added in Stripe Dashboard
- [ ] 4 events selected (payment_intent.*, charge.refunded)
- [ ] Webhook secret copied (starts with `whsec_`)
- [ ] `.env` file updated with secret
- [ ] Dev server restarted
- [ ] No syntax errors in `.env` file

---

## 🧪 **TESTING YOUR WEBHOOK**

### Test 1: Using Stripe CLI (Local)
```bash
# In terminal with stripe listen running:
stripe trigger payment_intent.succeeded
```

**Expected Result:**
- ✅ Event received by your app
- ✅ Order status updated to "paid" in database
- ✅ Notification created for customer
- ✅ Log entry in `webhook_logs` table

### Test 2: Using Stripe Dashboard (Production)
1. Go to: https://dashboard.stripe.com/test/payments
2. Click "Create a test payment"
3. Use test card: `4242 4242 4242 4242`
4. Expiry: Any future date (e.g., 12/25)
5. CVC: Any 3 digits (e.g., 123)
6. Complete payment

**Expected Result:**
- ✅ Webhook received at your endpoint
- ✅ Payment processed
- ✅ Order updated
- ✅ Customer notified

### Test 3: Check Webhook Logs
**In Stripe Dashboard:**
1. Developers → Webhooks
2. Click your endpoint
3. Click "Logs" tab
4. Should see successful deliveries (200 status)

**In Your Database:**
1. Open Supabase Dashboard
2. Table Editor → `webhook_logs`
3. Should see entries with status: "success"

---

## 🐛 **TROUBLESHOOTING**

### Problem: "Signature verification failed"
**Cause:** Wrong webhook secret

**Solution:**
1. Double-check the secret in Stripe Dashboard
2. Make sure you copied the entire string (starts with `whsec_`)
3. No extra spaces before/after in `.env` file
4. Restart dev server after changing `.env`

### Problem: "Webhook not receiving events"
**Cause:** Endpoint URL incorrect or server not accessible

**Solution:**
1. Verify URL in Stripe Dashboard matches your deployment
2. Make sure your app is deployed and running
3. Check that endpoint URL ends with `/api/webhooks/stripe`
4. For local testing, use Stripe CLI instead

### Problem: "Events received but order not updating"
**Cause:** Database error or missing order ID

**Solution:**
1. Check terminal logs for errors
2. Verify `stripe_payment_intent` field matches in orders table
3. Check Supabase logs: Dashboard → Logs
4. Verify order exists in database before testing

### Problem: "stripe command not found"
**Cause:** Stripe CLI not installed or not in PATH

**Solution:**
```powershell
# Check if installed
stripe --version

# If not found, add to PATH or reinstall
# Or use full path: C:\stripe\stripe.exe
```

---

## 🔑 **YOUR WEBHOOK CREDENTIALS**

Save these for reference:

**Account:** optimix sandbox  
**Account ID:** acct_1RfVl24FDZYCNCWY

**Webhook Endpoint:** (Your production URL)/api/webhooks/stripe  
**Webhook Secret:** `whsec_...` (from Stripe Dashboard)

**Events Listening For:**
1. ✅ `payment_intent.succeeded` - Payment completed
2. ✅ `payment_intent.payment_failed` - Payment failed
3. ✅ `payment_intent.canceled` - Payment canceled
4. ✅ `charge.refunded` - Refund processed

---

## 📚 **ADDITIONAL RESOURCES**

- **Stripe Webhooks Docs:** https://stripe.com/docs/webhooks
- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli
- **Test Cards:** https://stripe.com/docs/testing#cards
- **Webhook Events Reference:** https://stripe.com/docs/api/events/types

---

## 🎯 **NEXT STEPS**

After webhook setup:

1. ✅ Test a payment flow end-to-end
2. ✅ Verify order status updates
3. ✅ Check notifications are created
4. ✅ Review webhook logs
5. 🚀 Deploy to production!

---

## ⚠️ **IMPORTANT NOTES**

### Test vs Live Mode
- 🟡 **Test Mode:** Use for development (test card numbers)
- 🔴 **Live Mode:** Real money, real payments
- Always test in **Test Mode** first!

### Security
- ✅ Never commit webhook secret to git
- ✅ Keep `.env` files out of version control
- ✅ Use different secrets for test/live mode
- ✅ Regenerate secret if compromised

### Production Checklist
- [ ] Webhook configured in LIVE mode (after testing)
- [ ] Live webhook secret in production `.env`
- [ ] HTTPS enabled on your domain
- [ ] Error monitoring enabled (Sentry)
- [ ] Webhook logs monitored regularly

---

*Need help? Check your terminal logs and Stripe Dashboard → Developers → Logs*

