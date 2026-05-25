#!/bin/bash

# Clerk Webhook Forwarding Script for Unix/Mac
# This script helps set up webhook forwarding for localhost development

echo "🚀 Setting up Clerk Webhook Forwarding for Localhost"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed."
    echo ""
    echo "Please install ngrok:"
    echo "  1. Download from: https://ngrok.com/download"
    echo "  2. Or install via: npm install -g ngrok"
    echo "  3. Or install via: brew install ngrok (macOS)"
    echo ""
    echo "After installing, run this script again."
    exit 1
fi

echo "✅ ngrok is installed"
echo ""

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "⚠️  Warning: Dev server doesn't appear to be running on port 3000"
    echo "   Please start your dev server first: npm run dev"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Dev server is running on port 3000"
    echo ""
fi

echo "Starting ngrok tunnel..."
echo ""
echo "📋 Next steps:"
echo "  1. Copy the HTTPS URL from ngrok (e.g., https://abc123.ngrok-free.app)"
echo "  2. Go to Clerk Dashboard: https://dashboard.clerk.com"
echo "  3. Navigate to: Webhooks → Add Endpoint"
echo "  4. Enter URL: https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/clerk"
echo "  5. Select events: user.created, user.updated, user.deleted"
echo "  6. Copy the Signing Secret to your .env.local as CLERK_WEBHOOK_SECRET"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start ngrok
ngrok http 3000

