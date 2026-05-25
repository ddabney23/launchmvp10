# 🎯 HOW YOUR APPLICATION WORKS

**Project:** Optimix - Social Commerce Platform  
**Last Updated:** November 12, 2024

---

## 🏗️ ARCHITECTURE OVERVIEW

Your application is a **full-stack social commerce platform** built with:

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Backend:** Next.js API Routes + Supabase + Prisma ORM
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **Payments:** Stripe
- **Real-time:** Supabase Realtime
- **Storage:** Supabase Storage
- **UI:** Tailwind CSS + shadcn/ui
- **Testing:** Vitest + Playwright

---

## 🔄 USER FLOWS

### 1. **New User Registration**

```
User visits → /register
  ↓
Enter email/password
  ↓
Supabase Auth creates user
  ↓
Profile created in `profiles` table
  ↓
Redirect to /onboarding
  ↓
Choose role: Customer or Vendor
  ↓
Complete profile setup
  ↓
Redirect to /home
```

**Files Involved:**
- `app/(auth)/register/page.tsx` - Registration form
- `src/integrations/supabase/client.ts` - Auth client
- `src/lib/api.ts` - Profile creation

### 2. **Customer Buying Flow**

```
Browse marketplace → /marketplace
  ↓
Click listing → /listing/[id]
  ↓
Add to cart (CartContext)
  ↓
View cart → /cart
  ↓
Checkout → /checkout
  ↓
Enter shipping info
  ↓
Payment form (Stripe Elements)
  ↓
API: POST /api/payment/create-intent
  ↓
Stripe processes payment
  ↓
Webhook: POST /api/webhooks/stripe
  ↓
Order status updated to 'paid'
  ↓
Notification sent to buyer & vendor
  ↓
Redirect to /order/[id]
```

**Files Involved:**
- `app/(app)/marketplace/page.tsx` - Browse listings
- `app/(app)/listing/[id]/page.tsx` - Product details
- `src/contexts/CartContext.tsx` - Cart management
- `app/(app)/checkout/page.tsx` - Checkout form
- `app/api/payment/create-intent/route.ts` - Payment intent
- `app/api/webhooks/stripe/route.ts` - Webhook handler

### 3. **Vendor Selling Flow**

```
User clicks "Become Vendor"
  ↓
Fill vendor application → /onboarding/vendor
  ↓
API: POST /api/vendor/verify
  ↓
Upload business documents
  ↓
Admin reviews application
  ↓
Profile updated: vendor_verified = true
  ↓
Create listings → /create
  ↓
API: POST to Supabase /listings
  ↓
Listings appear in marketplace
  ↓
Manage orders → /vendor/dashboard
```

**Files Involved:**
- `app/(app)/onboarding/vendor/page.tsx` - Vendor onboarding
- `app/api/vendor/verify/route.ts` - Verification API
- `app/(app)/create/page.tsx` - Create listing form
- `app/(app)/vendor/dashboard/page.tsx` - Vendor dashboard
- `src/components/vendor/ListingForm.tsx` - Listing form

### 4. **Social Features Flow**

```
Create post → /home or /feed
  ↓
API: POST /posts (createPost)
  ↓
Post appears in feed
  ↓
Other users see in /feed
  ↓
Like/Comment on post
  ↓
APIs: POST /likes, POST /comments
  ↓
Real-time updates via Supabase Realtime
  ↓
Notifications sent to post author
```

**Files Involved:**
- `app/(app)/feed/page.tsx` - Social feed
- `src/components/PostCard.tsx` - Post display
- `src/lib/api.ts` - Post CRUD operations
- `src/lib/realtime.ts` - Real-time subscriptions

### 5. **Booking Services Flow**

```
Browse services → /marketplace
  ↓
Click service → /listing/[id]
  ↓
Select date/time
  ↓
API: POST /api/bookings/create
  ↓
Check for conflicts
  ↓
Create booking (status: pending)
  ↓
Notify vendor
  ↓
Vendor confirms → /vendor/dashboard
  ↓
API: PATCH /api/bookings/update
  ↓
Update status to 'confirmed'
  ↓
Notify customer
```

**Files Involved:**
- `app/api/bookings/create/route.ts` - Create booking
- `app/api/bookings/update/route.ts` - Update booking
- `app/(app)/vendor/dashboard/page.tsx` - Manage bookings

### 6. **Gamification Flow**

```
User performs action (post, purchase, etc.)
  ↓
API: POST /api/gamification/update
  ↓
Points awarded based on action
  ↓
Points added to profile
  ↓
Check badge thresholds
  ↓
Award badges if threshold reached
  ↓
Update leaderboard
  ↓
Show points/badges in UI
```

**Files Involved:**
- `app/api/gamification/update/route.ts` - Points system
- `src/components/gamification/PointsDisplay.tsx` - Points UI
- `src/components/gamification/BadgeDisplay.tsx` - Badges UI
- `app/(app)/rewards/page.tsx` - Rewards page

---

## 🗄️ DATABASE STRUCTURE

### Core Tables

**profiles**
- Stores user information
- Fields: username, display_name, avatar_url, is_vendor, points, credits
- Connected to: posts, listings, orders, bookings

**listings**
- Product/service listings
- Fields: title, description, price, images, category, vendor
- Connected to: profiles (vendor), orders, bookings

**orders**
- Purchase records
- Fields: buyer, vendor, total, status, stripe_payment_intent
- Connected to: profiles (buyer/vendor), order_items

**bookings**
- Service bookings
- Fields: listing_id, buyer, vendor, start_time, end_time, status
- Connected to: listings, profiles

**posts**
- Social media posts
- Fields: author, content, media_urls, visibility
- Connected to: profiles, comments, likes

**messages**
- Direct messaging
- Fields: channel_id, sender, body
- Connected to: profiles

**notifications**
- User notifications
- Fields: user_id, type, data, read
- Connected to: profiles

---

## 🔐 AUTHENTICATION & SECURITY

### How Authentication Works

1. **Sign Up/Login**
   - Supabase Auth handles authentication
   - JWT tokens stored in cookies
   - Session managed by Supabase client

2. **Protected Routes**
   - Middleware checks for valid session
   - `ProtectedRoute` component wraps authenticated pages
   - API routes verify user token

3. **Authorization**
   - Row Level Security (RLS) on Supabase tables
   - Ownership checks in API routes
   - Admin role checks for privileged operations

### Security Features

- **XSS Protection:** Content sanitization with `sanitizeString`
- **CSRF Protection:** Next.js built-in protection
- **Rate Limiting:** Middleware rate limits API requests
- **SQL Injection:** Prevented by Prisma ORM
- **Secure Headers:** CSP, X-Frame-Options, HSTS configured

---

## 💳 PAYMENT PROCESSING

### How Payments Work

1. **Customer adds items to cart**
   - Stored in React Context (CartContext)
   - Persisted to localStorage

2. **Checkout initiated**
   - Order created in database (status: pending)
   - Calculate total from cart items

3. **Payment Intent created**
   - API call to `/api/payment/create-intent`
   - Stripe Payment Intent created
   - Client secret returned to frontend

4. **Customer enters card details**
   - Stripe Elements collect card info securely
   - Stripe processes payment

5. **Webhook received**
   - Stripe sends event to `/api/webhooks/stripe`
   - Signature verified
   - Order status updated (paid/failed)
   - Notifications sent

6. **Order fulfilled**
   - Vendor processes order
   - Status updated through lifecycle
   - Customer receives updates

### Stripe Products

Your account has 5 products:
1. **Starter Plan** ($5.99/mo) - Basic vendor tier
2. **Pro Plan** ($12.99/mo) - Advanced features
3. **Enterprise Plan** ($29.99/mo) - Full access
4. **Small Listing Pack** ($12.99) - 5 extra listings
5. **Large Listing Pack** ($19.99) - 10 extra listings

---

## 📡 REAL-TIME FEATURES

### How Real-time Works

Using Supabase Realtime for live updates:

```typescript
// Subscribe to new messages
supabase
  .channel('messages')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      // New message received
      updateUI(payload.new)
    }
  )
  .subscribe()
```

**Real-time Features:**
- New messages in chat
- New notifications
- Post updates (likes, comments)
- Order status changes
- Booking confirmations

**Files:**
- `src/lib/realtime.ts` - Real-time utilities
- `app/(app)/messages/page.tsx` - Chat with real-time
- `app/(app)/notifications/page.tsx` - Live notifications

---

## 🎨 COMPONENT STRUCTURE

### UI Components (`src/components/ui/`)
- shadcn/ui components
- Fully accessible (ARIA)
- Customizable with Tailwind
- Examples: Button, Card, Dialog, Form, etc.

### Feature Components (`src/components/`)
- **PostCard** - Display social posts
- **ListingCard** - Show products/services
- **Navigation** - Main navigation
- **SearchBar** - Search functionality
- **NotificationsDropdown** - Notification center
- **ErrorBoundary** - Error handling

### Layout Components
- **AppLayout** - Main app wrapper
- **Navigation** - Top navigation bar
- **BottomNavigation** - Mobile bottom nav
- **ProtectedRoute** - Auth wrapper

---

## 🎮 KEY FEATURES

### 1. **Social Commerce**
- Social feed with posts
- Follow/unfollow users
- Like and comment on posts
- Share products in feed

### 2. **Marketplace**
- Browse products and services
- Search and filter listings
- Category-based navigation
- Vendor profiles

### 3. **Payments**
- Secure checkout with Stripe
- Order tracking
- Payment history
- Refund handling

### 4. **Bookings**
- Schedule service appointments
- Conflict detection
- Vendor confirmation
- Booking management

### 5. **Messaging**
- Direct messages between users
- Real-time chat
- Message history
- Read receipts

### 6. **Gamification**
- Points for actions
- Credits earned from purchases
- Badge system
- Leaderboards
- Reward redemption

### 7. **Admin Panel**
- User management
- Vendor verification
- Content moderation
- Analytics dashboard

### 8. **Groups**
- Create/join groups
- Group posts
- Member management
- Group chat

### 9. **News/Updates**
- Platform announcements
- Community updates
- Vendor spotlights
- Featured content

---

## 🛠️ API ENDPOINTS

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out

### Payments
- `POST /api/payment/create-intent` - Create payment
- `POST /api/webhooks/stripe` - Stripe webhooks

### Bookings
- `POST /api/bookings/create` - Create booking
- `GET /api/bookings/create` - List bookings
- `PATCH /api/bookings/update` - Update booking

### Gamification
- `POST /api/gamification/update` - Award points

### Vendor
- `POST /api/vendor/verify` - Apply for verification
- `GET /api/vendor/verify` - Check status

### System
- `GET /api/health` - Health check
- `GET /api/webhooks/logs` - Webhook logs

---

## 📱 PAGES & ROUTES

### Public Routes
- `/` - Landing page
- `/login` - Sign in
- `/register` - Sign up

### Authenticated Routes
- `/home` - Home feed
- `/feed` - Social feed
- `/explore` - Discovery
- `/marketplace` - Browse listings
- `/listing/[id]` - Product details
- `/cart` - Shopping cart
- `/checkout` - Payment
- `/orders` - Order history
- `/order/[id]` - Order details
- `/messages` - Chat
- `/notifications` - Notifications
- `/profile/[id]` - User profile
- `/profile/[id]/edit` - Edit profile
- `/groups` - Browse groups
- `/groups/[id]` - Group details
- `/news` - News feed
- `/news/[id]` - News article
- `/rewards` - Gamification
- `/search` - Search
- `/settings` - User settings

### Vendor Routes
- `/create` - Create listing
- `/vendor/dashboard` - Vendor dashboard
- `/onboarding/vendor` - Vendor onboarding

### Admin Routes
- `/admin` - Admin panel
- `/admin/realtime-diagnostics` - Real-time testing

---

## 🔧 CONFIGURATION FILES

- **next.config.ts** - Next.js configuration
- **tailwind.config.ts** - Tailwind CSS settings
- **prisma/schema.prisma** - Database schema
- **tsconfig.json** - TypeScript config
- **vitest.config.ts** - Test configuration
- **playwright.config.ts** - E2E test config
- **eslint.config.mjs** - Linting rules
- **src/middleware.ts** - Request middleware

---

## 🚀 DEPLOYMENT WORKFLOW

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
npm run lint         # Check code quality
```

### Production Build
```bash
npm run build        # Build for production
npm run start        # Start production server
```

### Vercel Deployment
```bash
# Connect to Vercel
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 📊 MONITORING & DEBUGGING

### Logs
- **Application Logs:** Terminal output
- **Supabase Logs:** Dashboard → Logs
- **Stripe Logs:** Dashboard → Developers → Logs
- **Error Tracking:** Sentry (configured)

### Health Check
```bash
curl http://localhost:3000/api/health
```

Returns status of:
- Supabase connection
- Prisma connection
- Environment variables
- Stripe configuration

### Database Queries
```bash
# Prisma Studio (GUI)
npx prisma studio

# SQL Editor in Supabase Dashboard
# Dashboard → SQL Editor
```

---

## 🎓 BEST PRACTICES IN THIS PROJECT

### Code Organization
✅ Feature-based folder structure  
✅ Separation of concerns  
✅ Reusable components  
✅ Type-safe APIs

### Error Handling
✅ Try-catch blocks in all API routes  
✅ Proper error messages  
✅ Error boundary for React  
✅ Graceful degradation

### Performance
✅ Dynamic imports for code splitting  
✅ Image optimization  
✅ API response caching  
✅ Database query optimization

### Security
✅ Input validation  
✅ Authentication on all routes  
✅ Authorization checks  
✅ Secure headers  
✅ Rate limiting

---

## 🤝 INTEGRATION POINTS

### Stripe Integration
- Payment processing
- Subscription management
- Webhook events
- Customer management

### Supabase Integration
- Authentication
- Database (PostgreSQL)
- Real-time subscriptions
- File storage
- Edge functions

### External Services
- **Sentry:** Error tracking
- **Google Analytics:** Usage analytics
- **Resend:** Transactional emails

---

## 📚 ADDITIONAL RESOURCES

### Documentation Files
- `PROJECT_AUDIT_REPORT.md` - Comprehensive audit
- `CRITICAL_FIXES_GUIDE.md` - Fix critical issues
- `API_DOCUMENTATION.md` - API reference
- `ENV_SETUP.md` - Environment setup
- `PRISMA_SETUP.md` - Database setup

### External Docs
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)

---

*Last Updated: November 12, 2024*  
*Your application is a modern, full-stack social commerce platform ready for deployment!*

