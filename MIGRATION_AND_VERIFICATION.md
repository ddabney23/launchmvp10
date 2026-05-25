# Migration and Verification Guide

## SQL Migration Required

**File:** `supabase/migrations/047_add_store_fields_and_fix_reviews.sql`

This migration adds:
1. Store fields to `profiles` table:
   - `store_name` (TEXT)
   - `store_description` (TEXT)
   - `store_banner_url` (TEXT)
   - `store_policies` (JSONB)
   - `store_hours` (JSONB)
   - `store_location` (TEXT)
   - `store_social_links` (JSONB)

2. Vendor review fields to `reviews` table:
   - `vendor_id` (UUID, references profiles)
   - `reviewer_id` (UUID, references profiles)
   - `comment` (TEXT)
   - Updates `rating` to NUMERIC(3,2) if it's currently INTEGER

3. Stripe Connect field to `vendor_profiles`:
   - `stripe_connect_account_id` (TEXT)

4. Indexes for performance:
   - `idx_reviews_vendor_id`
   - `idx_reviews_reviewer_id`
   - `idx_profiles_store_name`

## How to Apply Migration

### Option 1: Using Supabase CLI
```bash
supabase migration up
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/047_add_store_fields_and_fix_reviews.sql`
4. Run the migration

### Option 3: Direct SQL Execution
```sql
-- Run the migration file directly in your database
\i supabase/migrations/047_add_store_fields_and_fix_reviews.sql
```

## API Routes Verification

### ✅ Verified API Routes

1. **`/api/profile/update`** (PUT)
   - ✅ Handles store fields (store_name, store_description, etc.)
   - ✅ Uses Clerk authentication
   - ✅ Validates input with Zod schema
   - ✅ Updates profile correctly

2. **`/api/orders/create-multi-vendor`** (POST)
   - ✅ Groups items by vendor
   - ✅ Creates separate orders per vendor
   - ✅ Handles Stripe Connect payments
   - ✅ Calculates application fees
   - ✅ Returns multiple payment intents

3. **`/api/orders/[orderId]`** (PATCH)
   - ✅ Validates vendor ownership
   - ✅ Validates status transitions
   - ✅ Updates order status securely

4. **`/api/vendor/payouts`** (GET)
   - ✅ Fetches Stripe Connect payouts
   - ✅ Validates vendor ownership
   - ✅ Returns payout history

5. **`/api/vendor/balance`** (GET)
   - ✅ Fetches Stripe Connect balance
   - ✅ Calculates lifetime earnings
   - ✅ Returns available/pending balances

6. **`/api/vendor/refund`** (POST)
   - ✅ Validates vendor ownership
   - ✅ Creates Stripe refunds
   - ✅ Handles application fee refunds
   - ✅ Updates order status

## Component Verification

### ✅ Verified Components

1. **StoreSettings** (`src/components/vendor/StoreSettings.tsx`)
   - ✅ Uploads store banner
   - ✅ Updates store information
   - ✅ Manages store policies and hours
   - ✅ Handles JSON parsing/validation

2. **VendorEarnings** (`src/components/vendor/VendorEarnings.tsx`)
   - ✅ Displays balance metrics
   - ✅ Shows payout history
   - ✅ Fetches from correct API routes

3. **VendorOrderManagement** (`src/components/vendor/VendorOrderManagement.tsx`)
   - ✅ Displays order statistics
   - ✅ Filters orders by status
   - ✅ Updates order status
   - ✅ Shows order details

4. **VendorAnalytics** (`src/components/vendor/VendorAnalytics.tsx`)
   - ✅ Calculates revenue metrics
   - ✅ Shows growth trends
   - ✅ Displays performance data

5. **RefundManagement** (`src/components/vendor/RefundManagement.tsx`)
   - ✅ Lists refundable orders
   - ✅ Creates refunds via API
   - ✅ Shows refund history

## Database Schema Verification

### Profiles Table
- ✅ `store_name` - Added by migration
- ✅ `store_description` - Added by migration
- ✅ `store_banner_url` - Added by migration
- ✅ `store_policies` - Added by migration (JSONB)
- ✅ `store_hours` - Added by migration (JSONB)
- ✅ `store_location` - Added by migration
- ✅ `store_social_links` - Added by migration (JSONB)

### Reviews Table
- ✅ `vendor_id` - Added by migration (references profiles)
- ✅ `reviewer_id` - Added by migration (references profiles)
- ✅ `comment` - Added by migration
- ✅ `rating` - Updated to NUMERIC(3,2) by migration

### Vendor Profiles Table
- ✅ `stripe_connect_account_id` - Added by migration

## Function Verification

### ✅ Verified Functions

1. **`updateStoreProfile`** (`src/lib/api.ts`)
   - ✅ Calls `/api/profile/update` correctly
   - ✅ Handles all store fields

2. **`getStoreReviews`** (`src/lib/api.ts`)
   - ✅ Queries reviews by vendor_id
   - ✅ Includes reviewer profile data

3. **`createStoreReview`** (`src/lib/api.ts`)
   - ✅ Creates review with vendor_id
   - ✅ Links to reviewer_id
   - ✅ Handles Clerk ID conversion

4. **`getVendorPayouts`** (`src/lib/api.ts`)
   - ✅ Calls `/api/vendor/payouts` correctly

5. **`getVendorBalance`** (`src/lib/api.ts`)
   - ✅ Calls `/api/vendor/balance` correctly

6. **`createVendorRefund`** (`src/lib/api.ts`)
   - ✅ Calls `/api/vendor/refund` correctly

7. **`updateOrder`** (`src/lib/api.ts`)
   - ✅ Calls `/api/orders/[orderId]` correctly

8. **`createPaymentIntent`** (`src/lib/api.ts`)
   - ✅ Calls `/api/orders/create-multi-vendor` correctly
   - ✅ Handles single and multi-vendor responses

## Testing Checklist

### Before Deployment

- [ ] Run SQL migration `047_add_store_fields_and_fix_reviews.sql`
- [ ] Verify all columns exist in database
- [ ] Test store settings update
- [ ] Test store banner upload
- [ ] Test creating a review
- [ ] Test fetching reviews
- [ ] Test multi-vendor checkout
- [ ] Test order status updates
- [ ] Test payout fetching (requires Stripe Connect setup)
- [ ] Test balance fetching (requires Stripe Connect setup)
- [ ] Test refund creation
- [ ] Verify all API routes return correct responses

### Post-Deployment

- [ ] Monitor error logs for any migration issues
- [ ] Verify store profiles display correctly
- [ ] Test vendor dashboard functionality
- [ ] Verify analytics calculations
- [ ] Test order management workflow

## Known Issues & Notes

1. **Reviews Foreign Key**: The migration adds `vendor_id` to reviews table. The existing `store_id` column remains for backward compatibility with store_profiles.

2. **Stripe Connect**: Payout and balance features require vendors to complete Stripe Connect onboarding first.

3. **Application Fees**: Calculated based on vendor subscription tier. Default is 5% if calculation fails.

4. **Multi-Vendor Orders**: Creates separate orders per vendor. Each order has its own payment intent.

5. **Store Fields**: All store fields are optional and stored in the profiles table for simplicity.

## Support

If you encounter any issues:
1. Check that the migration has been applied
2. Verify all columns exist in the database
3. Check API route logs for errors
4. Verify Clerk authentication is working
5. Check Stripe configuration for payment features

