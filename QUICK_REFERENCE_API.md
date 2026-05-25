# API Routes Quick Reference

## Base URL
- **Local:** `http://localhost:3000/api`
- **Production:** `https://your-domain.com/api`

---

## Authentication

All protected routes require an `Authorization` header:
```
Authorization: Bearer <access_token>
```

Get the token from Supabase Auth:
```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

---

## API Endpoints

### Health Check
```
GET /api/health
```
**No auth required**

Returns system health status.

---

### Bookings

#### Create Booking
```
POST /api/bookings/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "listing_id": "uuid",
  "start_time": "2025-01-10T10:00:00Z",
  "end_time": "2025-01-10T12:00:00Z",
  "notes": "Optional notes"
}
```

#### Update Booking
```
PATCH /api/bookings/update?id=<booking_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "confirmed" | "canceled" | "completed",
  "start_time": "2025-01-10T10:00:00Z", // optional
  "end_time": "2025-01-10T12:00:00Z", // optional
  "notes": "Updated notes" // optional
}
```

#### Get Bookings
```
GET /api/bookings/create?role=buyer|vendor
Authorization: Bearer <token>
```

---

### Gamification

#### Update Points
```
POST /api/gamification/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "uuid",
  "action": "purchase" | "post_created" | "comment_created" | 
            "like_given" | "follow_user" | "listing_created" | 
            "booking_created" | "review_created",
  "metadata": {
    "amount": 100.00, // for purchase action
    // ... other metadata
  }
}
```

**Points Awarded:**
- Purchase: 10 points
- Post created: 5 points
- Comment created: 2 points
- Like given: 1 point
- Follow user: 3 points
- Listing created: 15 points
- Booking created: 8 points
- Review created: 5 points

---

### Vendor Verification

#### Submit Verification Application
```
POST /api/vendor/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessName": "My Business Inc.",
  "businessType": "LLC",
  "taxId": "12-3456789", // optional
  "businessAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  },
  "phoneNumber": "+1234567890",
  "idDocumentUrl": "https://storage.example.com/id.pdf",
  "businessLicenseUrl": "https://storage.example.com/license.pdf", // optional
  "additionalDocuments": ["https://..."], // optional
  "notes": "Additional information" // optional
}
```

#### Get Verification Status
```
GET /api/vendor/verify
Authorization: Bearer <token>
```

---

### Payments

#### Create Payment Intent
```
POST /api/payment/create-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 99.99,
  "orderId": "uuid",
  "currency": "usd", // optional, default: "usd"
  "customerId": "uuid" // optional
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

---

### Webhooks

#### Stripe Webhook
```
POST /api/webhooks/stripe
Stripe-Signature: <signature>
Content-Type: application/json

<Stripe event payload>
```

**Handled Events:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "details": [ // optional, for validation errors
    {
      "path": ["field"],
      "message": "Validation error"
    }
  ]
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Realtime Subscriptions

Use the unified realtime utility:

```typescript
import { useRealtimeSubscription } from '@/lib/realtime'
import { supabase } from '@/integrations/supabase/client'

// Subscribe to posts
useRealtimeSubscription(supabase, {
  table: 'posts',
  event: 'INSERT',
  filter: 'author=eq.user-id',
  callback: () => {
    queryClient.invalidateQueries(['posts'])
  },
  enabled: true,
})

// Subscribe to messages
useRealtimeSubscription(supabase, {
  table: 'messages',
  event: 'INSERT',
  filter: 'channel_id=eq.channel-id',
  callback: (payload) => {
    console.log('New message:', payload)
  },
  enabled: true,
})
```

---

## TypeScript Types

All request/response types are available from:
```typescript
import type { 
  Booking, 
  BookingCreate, 
  BookingUpdate 
} from '@/lib/types'
```

---

## Testing

### Local Testing
```bash
npm run dev
```

### Test Health Endpoint
```bash
curl http://localhost:3000/api/health
```

### Test Authenticated Endpoint
```bash
curl -X POST http://localhost:3000/api/bookings/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "listing_id": "uuid",
    "start_time": "2025-01-10T10:00:00Z",
    "end_time": "2025-01-10T12:00:00Z"
  }'
```

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # For admin operations
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Support

For issues or questions, refer to:
- `AUDIT_SUMMARY.md` - Full audit details
- `README.md` - Project documentation
- Supabase Dashboard - Database schema and logs

