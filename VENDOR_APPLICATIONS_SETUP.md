# Vendor Applications Table Setup

## Problem

The `vendor_applications` table doesn't exist in your Supabase database, which is causing the "Failed to submit verification application" error.

## Solution

A migration file has been created at `supabase/migrations/025_vendor_applications.sql` that will create the required table.

## How to Apply the Migration

### Option 1: Using Supabase CLI (Recommended)

1. Make sure you have the Supabase CLI installed:
   ```bash
   npm install -g supabase
   ```

2. Link your project (if not already linked):
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Apply the migration:
   ```bash
   supabase db push
   ```

### Option 2: Using Supabase Dashboard

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**
4. Copy the contents of `supabase/migrations/025_vendor_applications.sql`
5. Paste it into the SQL Editor
6. Click **Run**

### Option 3: Direct SQL Execution

If you have direct database access, you can run the SQL directly:

```sql
-- Copy and paste the contents of supabase/migrations/025_vendor_applications.sql
```

## What the Migration Creates

- **Table**: `vendor_applications` with all required columns
- **Indexes**: For better query performance
- **Triggers**: For automatic `updated_at` timestamp updates
- **RLS**: Row Level Security (disabled for Clerk compatibility - using admin client instead)

## After Applying the Migration

Once the migration is applied, the vendor onboarding flow should work correctly. The table will store:
- Business information
- Verification documents
- Application status (pending/approved/denied)
- Review information

## Testing

After applying the migration, try the vendor onboarding flow again. The application should submit successfully.

## Troubleshooting

If you still get errors after applying the migration:

1. Check that the table exists:
   ```sql
   SELECT * FROM vendor_applications LIMIT 1;
   ```

2. Check the error details in the browser console (now includes more detailed error messages)

3. Verify your Supabase connection is working

