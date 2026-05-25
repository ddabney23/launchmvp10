# New API Routes Documentation

This document covers all newly implemented API routes in the Optimix platform.

---

## **Leaderboard API**

### `GET /api/leaderboard`

Get top users ranked by points with optional period filtering.

**Query Parameters:**
- `period` (optional): `all-time`, `monthly`, or `weekly`. Default: `all-time`
- `limit` (optional): Number of users to return (1-100). Default: `50`

**Response:**
```json
{
  "period": "all-time",
  "leaderboard": [
    {
      "rank": 1,
      "userId": "uuid",
      "username": "john_doe",
      "fullName": "John Doe",
      "avatarUrl": "https://...",
      "points": 1250,
      "level": 25,
      "badges": ["early_adopter", "power_user"],
      "isCurrentUser": false
    }
  ],
  "currentUserRank": {
    "rank": 42,
    "userId": "uuid",
    "username": "current_user",
    "points": 350,
    "level": 12,
    "isCurrentUser": true
  },
  "timestamp": "2025-12-19T..."
}
```

**Caching:** 5 minutes  
**Authentication:** Optional (shows current user rank if authenticated)

---

## **Credit Redemption API**

### `POST /api/gamification/redeem`

Redeem credits for rewards (discounts, shipping, gift cards).

**Authentication:** Required

**Request Body:**
```json
{
  "rewardId": "discount-10",
  "credits": 100
}
```

**Available Rewards:**
- `discount-5`: 5% Discount (50 credits)
- `discount-10`: 10% Discount (100 credits)
- `discount-15`: 15% Discount (150 credits)
- `discount-20`: 20% Discount (200 credits)
- `free-shipping`: Free Shipping (75 credits)
- `gift-card-10`: $10 Gift Card (500 credits)
- `gift-card-25`: $25 Gift Card (1000 credits)
- `gift-card-50`: $50 Gift Card (1800 credits)

**Response:**
```json
{
  "success": true,
  "message": "Redemption successful",
  "redemption": {
    "id": "redemption_...",
    "user_id": "uuid",
    "reward_id": "discount-10",
    "reward_name": "10% Discount",
    "reward_type": "discount",
    "reward_value": 10,
    "credits_spent": 100,
    "status": "pending",
    "created_at": "2025-12-19T...",
    "expires_at": "2026-01-18T..."
  },
  "newBalance": 450
}
```

**Error Responses:**
- `400`: Insufficient credits or invalid reward
- `401`: Unauthorized
- `404`: Reward or profile not found

### `GET /api/gamification/redeem`

Get redemption history for the current user.

**Authentication:** Required

**Response:**
```json
{
  "redemptions": []
}
```

---

## **Reviews API**

### `POST /api/reviews`

Create a new review for a listing.

**Authentication:** Required

**Request Body:**
```json
{
  "listingId": "uuid",
  "orderId": "uuid (optional)",
  "rating": 5,
  "title": "Great product!",
  "content": "This product exceeded my expectations...",
  "images": ["https://...", "https://..."]
}
```

**Validation:**
- `rating`: 1-5 stars (integer)
- `title`: 3-100 characters
- `content`: 10-2000 characters
- `images`: Up to 5 image URLs

**Response:**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "listing_id": "uuid",
    "order_id": "uuid",
    "user_id": "uuid",
    "rating": 5,
    "title": "Great product!",
    "content": "This product exceeded...",
    "images": [],
    "verified_purchase": true,
    "helpful_count": 0,
    "created_at": "2025-12-19T..."
  }
}
```

**Side Effects:**
- Updates listing average rating
- Awards 5 points to reviewer
- Sends notification to vendor (TODO)

**Error Responses:**
- `400`: Invalid data, already reviewed, or self-review
- `401`: Unauthorized
- `404`: Listing not found

### `GET /api/reviews?listingId=xxx&page=1&limit=10&sortBy=recent`

Get reviews for a listing with pagination.

**Query Parameters:**
- `listingId` (required): Listing UUID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (1-50, default: 10)
- `sortBy` (optional): `recent`, `rating_high`, `rating_low`, `helpful` (default: `recent`)

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Great product!",
      "content": "...",
      "images": [],
      "verified_purchase": true,
      "helpful_count": 3,
      "created_at": "2025-12-19T...",
      "updated_at": "2025-12-19T...",
      "profile": {
        "id": "uuid",
        "username": "john_doe",
        "full_name": "John Doe",
        "avatar_url": "https://..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasMore": true
  },
  "ratingDistribution": {
    "5": 30,
    "4": 10,
    "3": 5,
    "2": 3,
    "1": 2
  }
}
```

### `PATCH /api/reviews/[id]`

Update an existing review.

**Authentication:** Required (must be review author)

**Request Body:**
```json
{
  "rating": 4,
  "title": "Updated title",
  "content": "Updated content",
  "images": ["https://..."]
}
```

**Response:**
```json
{
  "success": true,
  "review": { /* updated review */ }
}
```

**Error Responses:**
- `403`: Cannot update another user's review
- `404`: Review not found

### `DELETE /api/reviews/[id]`

Delete a review.

**Authentication:** Required (must be review author)

**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

**Side Effects:**
- Updates listing average rating
- Updates listing review count

---

## **Order Cancellation API**

### `POST /api/orders/[orderId]/cancel`

Cancel an order and initiate refund.

**Authentication:** Required (must be buyer or vendor)

**Request Body:**
```json
{
  "reason": "Customer changed their mind. Need to cancel this order.",
  "refundAmount": 99.99
}
```

**Validation:**
- `reason`: 10-500 characters
- `refundAmount` (optional): Defaults to full order amount

**Cancellable Statuses:**
- `pending`
- `confirmed`
- `processing`

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "order": {
    "id": "uuid",
    "status": "cancelled",
    "refundAmount": 99.99,
    "refundStatus": "initiated"
  }
}
```

**Side Effects:**
- Updates order status to `cancelled`
- Restores stock quantity for listing
- Initiates Stripe refund (if payment made)
- Sends notifications to buyer and vendor
- Creates audit trail

**Refund Statuses:**
- `initiated`: Refund process started
- `failed`: Refund failed (logged for manual review)
- `not_applicable`: No payment to refund

**Error Responses:**
- `400`: Order cannot be cancelled (wrong status)
- `403`: Not authorized to cancel this order
- `404`: Order not found

---

## **Common Error Responses**

All API routes follow a consistent error format:

```json
{
  "error": "Error message",
  "details": [] // Optional validation details
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (not authorized)
- `404`: Not Found
- `500`: Internal Server Error

---

## **Rate Limiting**

All API routes are protected by rate limiting middleware:
- Default: 100 requests per 15 minutes per IP
- Leaderboard: 30 requests per minute
- Reviews: 10 creates per hour, unlimited reads
- Redemption: 5 redemptions per hour

Suspicious activity is logged and may result in temporary blocks.

---

## **Authentication**

All protected routes use Clerk authentication:
- Include Clerk session cookie in requests
- `userId` is extracted from `auth()` context
- Profile lookup performed via `clerk_id` field

---

## **Caching Strategy**

| Endpoint | Cache Duration | Cache Key |
|----------|---------------|-----------|
| `/api/leaderboard` | 5 minutes | `leaderboard:{period}:{limit}` |
| Trending posts | 10 minutes | `trending:posts:{limit}` |
| Trending vendors | 15 minutes | `trending:vendors:{limit}` |
| Personalized trends | 5 minutes | `trending:personalized:{userId}:{limit}` |

Cache invalidation is automatic via TTL. Manual invalidation not yet implemented.

---

## **Future Enhancements**

- [ ] Webhook support for external integrations
- [ ] Bulk operations endpoints
- [ ] GraphQL API layer
- [ ] Real-time subscriptions via WebSockets
- [ ] API versioning (v2)
- [ ] OpenAPI/Swagger documentation
- [ ] SDK generation for popular languages

