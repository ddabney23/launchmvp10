# 🧪 COMPREHENSIVE TEST SUITE

**Last Updated:** November 12, 2024  
**Test Status:** Ready to Execute

---

## 📋 **TEST OVERVIEW**

This document contains all tests needed to verify your application is working correctly after the critical fixes.

---

## ✅ **TEST 1: ENVIRONMENT VARIABLES**

### Purpose
Verify all required environment variables are set correctly.

### How to Run
```powershell
# Run from project root
node -e "const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'DATABASE_URL', 'NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']; const missing = required.filter(v => !process.env[v]); if (missing.length) { console.log('❌ Missing:', missing.join(', ')); process.exit(1); } else { console.log('✅ All required env vars present'); }"
```

### Expected Result
```
✅ All required env vars present
```

### If Failed
- Check `.env` file exists in project root
- Verify all variables are set (no placeholders)
- No extra spaces or quotes around values

---

## ✅ **TEST 2: HEALTH ENDPOINT**

### Purpose
Verify all services (Supabase, Stripe, Database) are connected and healthy.

### How to Run
```powershell
# Start dev server (if not running)
npm run dev

# Wait 30 seconds for compilation, then:
curl http://localhost:3000/api/health
```

### Expected Result
```json
{
  "status": "healthy",
  "checks": {
    "supabase": "healthy",
    "prisma": "healthy",
    "environment": "healthy",
    "stripe": "healthy"
  },
  "version": "1.0.0",
  "responseTime": "50ms"
}
```

### If Failed
- **supabase unhealthy:** Check SUPABASE_URL and keys
- **stripe unhealthy:** Check STRIPE_SECRET_KEY
- **environment unhealthy:** Missing env vars
- **503 error:** Server still compiling, wait longer

---

## ✅ **TEST 3: SUPABASE CONNECTION**

### Purpose
Test direct database connection and query capability.

### How to Run
**Option A: Using Supabase Dashboard**
1. Go to: https://app.supabase.com
2. Select your project
3. SQL Editor (left sidebar)
4. Run this query:
```sql
SELECT COUNT(*) as profile_count FROM profiles;
```

**Option B: Using API Route**
```powershell
curl http://localhost:3000/api/health
# Check "supabase": "healthy"
```

### Expected Result
- Query executes successfully
- Returns count (even if 0)
- No errors

### If Failed
- Check DATABASE_URL format
- Verify password has no brackets
- Check Supabase project is active

---

## ✅ **TEST 4: STRIPE CONNECTION**

### Purpose
Verify Stripe API is accessible with your keys.

### How to Run
```powershell
# Test Stripe connection
curl http://localhost:3000/api/health
# Check "stripe": "healthy"
```

**OR test Stripe CLI:**
```bash
stripe balance
```

### Expected Result
```json
{
  "stripe": "healthy"
}
```

**OR Stripe CLI shows:**
```
Available: $0.00
Pending: $0.00
```

### If Failed
- Check STRIPE_SECRET_KEY is set
- Verify key starts with `sk_test_`
- Login to Stripe Dashboard to verify account

---

## ✅ **TEST 5: NOTIFICATION CREATION**

### Purpose
Test that notifications can be created with the fixed schema.

### How to Run
**Manual Test via Supabase Dashboard:**
1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
```sql
INSERT INTO notifications (user_id, type, data, read)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  'test_notification',
  '{"title": "Test", "message": "Testing notification schema", "test": true}'::jsonb,
  false
)
RETURNING *;
```

**Expected Result:**
```
✅ 1 row inserted
```

**Verify:**
```sql
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1;
```

Should show your test notification with data field containing title and message.

### If Failed
- Check notifications table exists
- Verify profiles table has at least one user
- Check data field is JSONB type

---

## ✅ **TEST 6: GAMIFICATION POINTS**

### Purpose
Test that points can be recorded in user_points table.

### How to Run
**Manual Test via Supabase Dashboard:**
```sql
-- Insert test point entry
INSERT INTO user_points (user_id, points, reason, metadata, awarded_at)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  10,
  'test_action',
  '{"source": "manual_test"}'::jsonb,
  NOW()
)
RETURNING *;
```

**Expected Result:**
```
✅ 1 row inserted
```

**Verify:**
```sql
SELECT * FROM user_points ORDER BY awarded_at DESC LIMIT 1;
```

### If Failed
- Check user_points table exists
- Verify table schema matches:
  - user_id (uuid)
  - points (integer)
  - reason (text)
  - metadata (jsonb)
  - awarded_at (timestamp)

---

## ✅ **TEST 7: WEBHOOK ENDPOINT**

### Purpose
Test webhook endpoint responds to requests.

### How to Run
**Method 1: Stripe CLI (Recommended)**
```bash
# Start stripe listen (in separate terminal)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, trigger test event
stripe trigger payment_intent.succeeded
```

**Method 2: Manual cURL**
```powershell
curl -X POST http://localhost:3000/api/webhooks/stripe `
  -H "Content-Type: application/json" `
  -d '{\"type\": \"ping\"}'
```

### Expected Result
**Stripe CLI:**
```
✅ Received event payment_intent.succeeded
```

**Check webhook_logs table:**
```sql
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 1;
```

### If Failed
- Check STRIPE_WEBHOOK_SECRET is set
- Verify webhook route exists at `/api/webhooks/stripe`
- Check terminal for error logs

---

## ✅ **TEST 8: END-TO-END PAYMENT FLOW**

### Purpose
Test complete payment flow from cart to confirmation.

### Prerequisites
- Dev server running
- Stripe webhook configured (Test or CLI)
- At least one listing in database

### How to Run
1. **Start the app:** `npm run dev`
2. **Open browser:** http://localhost:3000
3. **Login/Register** a test account
4. **Add item to cart:**
   - Go to /marketplace
   - Click on a listing
   - Click "Add to Cart"
5. **Checkout:**
   - Go to /cart
   - Click "Checkout"
   - Fill in shipping info
6. **Pay with test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
7. **Submit payment**

### Expected Result
1. ✅ Payment succeeds
2. ✅ Redirect to order confirmation page
3. ✅ Order status: "paid" in database
4. ✅ Notification created for customer
5. ✅ Webhook logged in webhook_logs table

### Verification Queries
```sql
-- Check order was created
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Check notification was created
SELECT * FROM notifications 
WHERE type = 'payment_success' 
ORDER BY created_at DESC LIMIT 1;

-- Check webhook was logged
SELECT * FROM webhook_logs 
WHERE event_type = 'payment_intent.succeeded' 
ORDER BY created_at DESC LIMIT 1;
```

### If Failed
- Check terminal logs for errors
- Verify Stripe keys are correct
- Check webhook secret is set
- Review Supabase logs

---

## ✅ **TEST 9: BOOKING FLOW**

### Purpose
Test booking creation and notification.

### How to Run
1. **Create a service listing** (if not exists)
2. **Go to listing page**
3. **Select date/time**
4. **Submit booking request**

### Expected Result
1. ✅ Booking created with status "pending"
2. ✅ Notification sent to vendor
3. ✅ Booking appears in vendor dashboard

### Verification
```sql
-- Check booking created
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 1;

-- Check notification sent to vendor
SELECT * FROM notifications 
WHERE type = 'new_booking' 
ORDER BY created_at DESC LIMIT 1;
```

---

## ✅ **TEST 10: VENDOR VERIFICATION**

### Purpose
Test vendor application and notification system.

### How to Run
1. **Go to:** /onboarding/vendor
2. **Fill in vendor application**
3. **Submit**

### Expected Result
1. ✅ Application created
2. ✅ Notification sent to admins
3. ✅ Notification sent to applicant

### Verification
```sql
-- Check application
SELECT * FROM vendor_applications ORDER BY created_at DESC LIMIT 1;

-- Check admin notification
SELECT * FROM notifications 
WHERE type = 'vendor_verification_request' 
ORDER BY created_at DESC LIMIT 1;

-- Check user notification
SELECT * FROM notifications 
WHERE type = 'vendor_application_submitted' 
ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 **TEST RESULTS SUMMARY**

After running all tests, fill out this checklist:

- [ ] ✅ Test 1: Environment variables - PASSED
- [ ] ✅ Test 2: Health endpoint - PASSED
- [ ] ✅ Test 3: Supabase connection - PASSED
- [ ] ✅ Test 4: Stripe connection - PASSED
- [ ] ✅ Test 5: Notification creation - PASSED
- [ ] ✅ Test 6: Gamification points - PASSED
- [ ] ✅ Test 7: Webhook endpoint - PASSED
- [ ] ✅ Test 8: End-to-end payment - PASSED
- [ ] ✅ Test 9: Booking flow - PASSED
- [ ] ✅ Test 10: Vendor verification - PASSED

---

## 🐛 **COMMON ISSUES & SOLUTIONS**

### Issue: Tests timeout or hang
**Solution:** Increase timeout, check if dev server is running

### Issue: "Table does not exist" errors
**Solution:** Run migrations or check Supabase schema

### Issue: "Invalid API key" errors
**Solution:** Verify keys in `.env`, restart dev server

### Issue: Webhooks not received
**Solution:** Check webhook secret, use Stripe CLI for local testing

---

## 🎯 **AUTOMATED TEST SCRIPT**

Save this as `run-tests.ps1`:

```powershell
# Automated Test Runner
Write-Host "🧪 Running Optimix Test Suite..." -ForegroundColor Cyan

# Test 1: Environment
Write-Host "`n✅ TEST 1: Environment Variables" -ForegroundColor Yellow
node -e "const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'DATABASE_URL']; const missing = required.filter(v => !process.env[v]); if (missing.length) { console.log('❌ FAILED: Missing', missing.join(', ')); } else { console.log('✅ PASSED'); }"

# Test 2: Health Endpoint
Write-Host "`n✅ TEST 2: Health Endpoint" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get
    if ($response.status -eq "healthy") {
        Write-Host "✅ PASSED - All systems healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠️ WARNING - Status: $($response.status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ FAILED - Server not responding" -ForegroundColor Red
}

Write-Host "`n✅ Automated tests complete!" -ForegroundColor Cyan
Write-Host "Run manual tests from TEST_SUITE.md for complete verification" -ForegroundColor White
```

**Run with:**
```powershell
.\run-tests.ps1
```

---

*For full test details, see individual test sections above*

