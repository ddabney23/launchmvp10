# Vendor Onboarding Flow - What Happens After Submission

## Overview
This document explains what happens after a vendor submits their onboarding application.

## Submission Process

### 1. Application Submission (`/api/vendor/verify` POST)
- **Creates vendor application** in `vendor_applications` table with status `pending`
- **Updates profile** to set `is_vendor = true` (but `vendor_verified = false`)
- **Creates notifications**:
  - Admin notification: `vendor_verification_request`
  - User notification: `vendor_application_submitted`
- **Returns**: Application object with `id` and `user_id` (profile UUID)

### 2. Profile Update
- Updates profile with vendor details (bio, logo, etc.)
- Sets `onboarding_completed = true`

### 3. Subscription Creation
- Creates subscription based on selected tier (free/basic/pro/pro/premium)
- If free tier: Creates subscription record without Stripe
- If paid tier: Creates Stripe customer and subscription

### 4. First Product Creation (Optional)
- Creates first listing/product if provided
- Sets `active = false` (won't be public until vendor is approved)

### 5. Redirect
- Redirects to `/vendor/{profileId}` (vendor dashboard)
- Shows success toast: "Vendor onboarding complete! 🎉"

## What Vendor Sees After Submission

### On Vendor Dashboard (`/vendor/{id}`)

1. **Pending Approval Banner** (Yellow Alert)
   - Shows when: `is_vendor = true` AND `vendor_verified = false`
   - Message: "Your vendor application is under review. You'll be notified once approved."
   - Includes denial reason if application was denied

2. **Dashboard Features Available**
   - Can view their profile
   - Can create listings (but they'll be inactive until approved)
   - Can manage subscription
   - Can set up Stripe Connect (but won't receive payouts until verified)
   - **Cannot**: Receive orders, process payments, or have active listings

3. **Status Check**
   - Dashboard fetches vendor status from `/api/vendor/verify` GET
   - Shows application status: `pending`, `approved`, or `denied`

## Admin Review Process

1. **Admin receives notification** about new vendor application
2. **Admin reviews** application in Admin Dashboard (`/admin`)
3. **Admin can**:
   - Approve: Sets `vendor_verified = true`, activates listings
   - Deny: Sets status to `denied`, provides reason

## After Approval

Once admin approves:
- `vendor_verified = true` is set on profile
- **Pending Approval banner disappears**
- **Verified Vendor Badge** appears
- Listings can be activated (`active = true`)
- Vendor can receive orders and payments
- Stripe Connect payouts become active

## Error Handling

### Common Issues Fixed:
1. **Profile not found**: Automatically creates profile if missing
2. **Response parsing**: Improved JSON parsing with better error messages
3. **Profile ID extraction**: Handles both Clerk ID and Profile UUID
4. **Redirect**: Falls back to Clerk ID if profile UUID unavailable

### Error Messages:
- **Authentication failed**: User not signed in
- **Profile not found**: Profile creation failed (should auto-create)
- **Database error**: Table missing or connection issue
- **Validation error**: Invalid form data

## Next Steps for Vendor

After submission, vendor should:
1. Wait for admin approval (usually 24-48 hours)
2. Check dashboard for status updates
3. Complete Stripe Connect setup (optional, can do after approval)
4. Prepare product listings (can create but won't be active)
5. Review subscription plan and upgrade if needed

