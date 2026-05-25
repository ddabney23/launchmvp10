# Webhook Setup Guide for Localhost

## Quick Start

### Option 1: Using npm script (Recommended)

1. **Install ngrok** (if not already installed):
   ```bash
   npm install -g ngrok
   ```

2. **Start your dev server** (in one terminal):
   ```bash
   npm run dev
   ```

3. **Start webhook forwarding** (in another terminal):
   ```bash
   # Windows
   npm run webhook:forward:win
   
   # Unix/Mac
   npm run webhook:forward:unix
   
   # Or use the Node.js script (cross-platform)
   npm run webhook:forward
   ```

4. **Copy the ngrok HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

5. **Configure in Clerk Dashboard**:
   - Go to https://dashboard.clerk.com
   - Navigate to **Webhooks** → **Add Endpoint**
   - Enter URL: `https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/clerk`
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Copy the **Signing Secret** to your `.env.local`:
     ```env
     CLERK_WEBHOOK_SECRET=whsec_...
     ```

### Option 2: Manual ngrok

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Start ngrok** (in another terminal):
   ```bash
   ngrok http 3000
   ```

3. Follow steps 4-5 from Option 1 above.

## Testing

1. **Create a test user** in Clerk Dashboard
2. **Check Supabase** - A profile should be automatically created in the `profiles` table
3. **Check your terminal** - You should see webhook logs
4. **Check ngrok web interface** - Visit http://127.0.0.1:4040 to see request details

## Troubleshooting

### ngrok not found
- Install ngrok: `npm install -g ngrok`
- Or download from: https://ngrok.com/download
- Or use Homebrew (macOS): `brew install ngrok`

### Dev server not running
- Make sure your Next.js dev server is running on port 3000
- Check: `curl http://localhost:3000`

### Webhook not receiving events
- Verify the URL in Clerk dashboard matches your ngrok URL
- Check that `CLERK_WEBHOOK_SECRET` is set correctly
- Check ngrok web interface (http://127.0.0.1:4040) for incoming requests
- Check your Next.js console for errors

### ngrok URL changes
- Free ngrok URLs change each time you restart
- Update the webhook URL in Clerk dashboard when ngrok restarts
- For stable URLs, consider ngrok paid plan or use production domain

## Production Setup

For production, use your actual domain:

1. Deploy your app to production
2. In Clerk Dashboard, update webhook URL to:
   ```
   https://yourdomain.com/api/webhooks/clerk
   ```
3. Ensure `CLERK_WEBHOOK_SECRET` is set in production environment variables

## Scripts Available

- `npm run webhook:forward` - Cross-platform Node.js script
- `npm run webhook:forward:win` - Windows PowerShell script
- `npm run webhook:forward:unix` - Unix/Mac bash script

## Notes

- Keep both your dev server AND ngrok running while testing
- The ngrok tunnel will close if you stop the script (Ctrl+C)
- Free ngrok sessions may timeout after inactivity
- For persistent testing, consider ngrok's paid plan with reserved domains

