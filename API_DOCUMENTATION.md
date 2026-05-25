# 📚 Optimix API Documentation

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

Most endpoints require authentication via Supabase. Include the session token in requests:

```javascript
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession()
// Token is automatically included in supabase requests
```

---

## Payment API

### Create Payment Intent

Creates a Stripe payment intent for an order.

**Endpoint**: `POST /api/payment/create-intent`

**Request Body**:
```json
{
  "amount": 99.99,
  "orderId": "uuid-string",
  "currency": "usd",
  "customerId": "uuid-string"
}
```

**Response** (200):
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

**Errors**:
- `400`: Missing required fields or invalid amount
- `404`: Order not found
- `500`: Payment system error

---

### Stripe Webhook

Handles Stripe webhook events.

**Endpoint**: `POST /api/webhooks/stripe`

**Headers**:
```
stripe-signature: t=xxx,v1=xxx
```

**Events Handled**:
- `payment_intent.succeeded` - Marks order as paid
- `payment_intent.payment_failed` - Marks order as failed
- `payment_intent.canceled` - Marks order as canceled
- `charge.refunded` - Processes refund

**Response** (200):
```json
{
  "received": true
}
```

---

## Bookings API

### Create Booking

Creates a new booking request.

**Endpoint**: `POST /api/bookings/create`

**Authentication**: Required

**Request Body**:
```json
{
  "listing_id": "uuid-string",
  "start_date": "2024-01-15T00:00:00Z",
  "end_date": "2024-01-20T00:00:00Z",
  "customer_id": "uuid-string",
  "notes": "Optional booking notes"
}
```

**Response** (200):
```json
{
  "success": true,
  "booking": {
    "id": "uuid-string",
    "listing_id": "uuid-string",
    "customer_id": "uuid-string",
    "vendor_id": "uuid-string",
    "start_date": "2024-01-15T00:00:00Z",
    "end_date": "2024-01-20T00:00:00Z",
    "status": "pending",
    "total_price": 499.95,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "Booking created successfully. Waiting for vendor confirmation."
}
```

**Errors**:
- `400`: Invalid dates or missing fields
- `404`: Listing not found
- `409`: Time slot not available (conflicts with existing booking)
- `500`: Server error

---

### Get Bookings

Retrieves bookings for a user.

**Endpoint**: `GET /api/bookings/create?userId={uuid}&role={customer|vendor}`

**Authentication**: Required

**Query Parameters**:
- `userId` (required): User ID
- `role` (optional): `customer` or `vendor` - filters bookings by role

**Response** (200):
```json
{
  "bookings": [
    {
      "id": "uuid-string",
      "listing_id": "uuid-string",
      "customer_id": "uuid-string",
      "vendor_id": "uuid-string",
      "start_date": "2024-01-15T00:00:00Z",
      "end_date": "2024-01-20T00:00:00Z",
      "status": "confirmed",
      "total_price": 499.95,
      "listing": {
        "id": "uuid-string",
        "title": "Cozy Cabin",
        "images": ["url1", "url2"]
      },
      "customer": {
        "id": "uuid-string",
        "username": "johndoe",
        "display_name": "John Doe",
        "avatar_url": "url"
      }
    }
  ]
}
```

---

## Health Check API

### Health Status

Returns the health status of the application.

**Endpoint**: `GET /api/health`

**Authentication**: Not required

**Response** (200):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "checks": {
    "supabase": "healthy",
    "environment": "healthy",
    "stripe": "healthy"
  },
  "version": "1.0.0",
  "uptime": 3600,
  "responseTime": "45ms"
}
```

**Status Codes**:
- `200`: Healthy or degraded
- `503`: Unhealthy (critical services down)

**Check Statuses**:
- `healthy`: Service is operational
- `unhealthy`: Service is down
- `unknown`: Service status could not be determined

---

## Supabase Database API

All database operations use Supabase client. Here are the main table operations:

### Profiles

```javascript
// Get profile
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single()

// Update profile
const { error } = await supabase
  .from('profiles')
  .update({ display_name: 'New Name' })
  .eq('id', userId)
```

### Posts

```javascript
// Create post
const { data, error } = await supabase
  .from('posts')
  .insert({
    author: userId,
    content: 'Post content',
    media_urls: ['url1', 'url2'],
    visibility: 'public'
  })

// Get feed posts
const { data, error } = await supabase
  .from('posts')
  .select(`
    *,
    author_profile:profiles!posts_author_fkey(*)
  `)
  .order('created_at', { ascending: false })
  .limit(20)
```

### Listings

```javascript
// Create listing
const { data, error } = await supabase
  .from('listings')
  .insert({
    vendor: userId,
    title: 'Product Title',
    description: 'Description',
    price: 99.99,
    images: ['url1'],
    active: true
  })

// Search listings
const { data, error } = await supabase
  .from('listings')
  .select('*')
  .eq('active', true)
  .ilike('title', `%${searchTerm}%`)
```

### Orders

```javascript
// Create order
const { data, error } = await supabase
  .from('orders')
  .insert({
    customer_id: userId,
    total: 149.99,
    status: 'pending'
  })
  .select()
  .single()

// Add order items
const { error: itemsError } = await supabase
  .from('order_items')
  .insert([
    {
      order_id: orderId,
      listing_id: listingId,
      quantity: 2,
      price: 49.99
    }
  ])
```

---

## Error Handling

All API endpoints return errors in a consistent format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (not authorized)
- `404`: Not Found
- `409`: Conflict (e.g., booking collision)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

---

## Rate Limiting

API routes are rate limited to prevent abuse:

- **Default**: 10 requests per minute per IP
- **Auth endpoints**: 5 requests per minute per IP
- **Payment endpoints**: 3 requests per minute per user

When rate limited, you'll receive a `429` status code:

```json
{
  "error": "Too many requests"
}
```

---

## Webhooks

### Stripe Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` env var

---

## Testing

### Test Stripe Payments

Use these test card numbers in development:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

Any future expiry date and any 3-digit CVC.

### Test Webhooks Locally

Use Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

---

## SDK & Client Libraries

### JavaScript/TypeScript

```javascript
import { createClient } from '@/integrations/supabase/client'

const supabase = createClient()

// Example: Create booking
const response = await fetch('/api/bookings/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    listing_id: 'uuid',
    start_date: '2024-01-15',
    end_date: '2024-01-20',
    customer_id: userId,
  })
})

const data = await response.json()
```

---

## Support

For API support:
- **Documentation**: https://docs.optimix.com
- **Email**: support@optimix.com
- **GitHub Issues**: https://github.com/optimix/optimix/issues

---

**API Version**: v1.0.0  
**Last Updated**: 2024-01-01

