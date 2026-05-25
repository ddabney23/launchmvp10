# Clerk Webhook Setup Guide

## Overview

The Clerk webhook handler automatically syncs user data from Clerk to your Supabase `profiles` table. When a user signs up in Clerk, a profile is automatically created in Supabase.

## Setup Instructions

### 1. Install Dependencies

The `svix` package is required for webhook verification:

```bash
npm install svix
```

### 2. Environment Variables

Add the following to your `.env.local`:

```env
CLERK_WEBHOOK_SECRET=whsec_...
```

### 3. Configure Clerk Webhook

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Webhooks** in the sidebar
3. Click **Add Endpoint**
4. Set the endpoint URL to:
   ```
   https://your-domain.com/api/webhooks/clerk
   ```
   For local development, use a tool like [ngrok](https://ngrok.com):
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/clerk
   ```
5. Select the following events to subscribe to:
   - `user.created` - Creates profile when user signs up
   - `user.updated` - Updates profile when user updates their info
   - `user.deleted` - (Optional) Handles user deletion
6. Copy the **Signing Secret** and add it to your `.env.local` as `CLERK_WEBHOOK_SECRET`

### 4. Test the Webhook

1. Create a test user in Clerk
2. Check your Supabase `profiles` table - a new profile should be created automatically
3. Update the user in Clerk (e.g., change name or email)
4. Check that the profile was updated in Supabase

## Webhook Handler Details

The webhook handler (`app/api/webhooks/clerk/route.ts`) handles:

### `user.created` Event
- Creates a new profile in Supabase `profiles` table
- Uses Clerk user ID as the profile ID
- Generates a unique username from email
- Sets default values for new users

### `user.updated` Event
- Updates profile when user changes:
  - Email address
  - First/Last name
  - Username
  - Profile image

### `user.deleted` Event
- Currently just logs the deletion
- You may want to implement soft-delete or anonymization

## Troubleshooting

### Webhook Not Receiving Events

1. Check that the webhook URL is correct and accessible
2. Verify `CLERK_WEBHOOK_SECRET` is set correctly
3. Check Clerk dashboard webhook logs for delivery status
4. Check your application logs for errors

### Profile Not Created

1. Verify the webhook is receiving `user.created` events
2. Check Supabase logs for database errors
3. Ensure RLS policies allow profile creation
4. Check that the `profiles` table exists and has correct schema

### Profile Update Not Working

1. Verify the webhook is receiving `user.updated` events
2. Check that the profile exists in Supabase
3. Verify RLS policies allow profile updates
4. Check application logs for update errors

## Security Notes

- The webhook uses Svix to verify webhook signatures
- Never expose `CLERK_WEBHOOK_SECRET` in client-side code
- Always verify webhook signatures before processing events
- Use HTTPS for webhook endpoints in production

## Manual Profile Creation (Fallback)

If webhooks are not set up, profiles can still be created manually during onboarding. The onboarding flow will create a profile if one doesn't exist.

However, it's recommended to use webhooks for automatic profile sync to ensure consistency.

