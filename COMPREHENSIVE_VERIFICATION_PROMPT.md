# 🔍 COMPREHENSIVE VERIFICATION PROMPT
## Complete API & Page Testing & Error Resolution Guide

**Purpose**: Systematically verify all APIs, pages, functions, UI/UX, and build processes  
**Status**: Active Verification  
**Last Updated**: January 2025

---

## 📋 HOW TO USE THIS PROMPT

### For AI Assistants (Cursor, ChatGPT, Claude, etc.)

**Copy this entire prompt** and ask:
> "Please execute the COMPREHENSIVE VERIFICATION PROMPT. Check all APIs, pages, functions, UI/UX, and build processes. Document any errors found with explanations and fixes."

Or use specific sections:
> "Please execute Phase 1: Build Verification from the COMPREHENSIVE_VERIFICATION_PROMPT.md"

---

## 🎯 PROJECT CONTEXT

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Supabase
- **Authentication**: Clerk
- **Payments**: Stripe
- **UI**: Tailwind CSS + Radix UI
- **State**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod

### Current Status
- ✅ Database migrations complete (51 tables, 59 RLS policies, 11 realtime tables)
- ✅ Core features implemented
- ⚠️ Needs comprehensive verification
- ⚠️ Needs error resolution
- ⚠️ Needs UI/UX polish

---

## 🚀 PHASE 1: BUILD VERIFICATION

### Task 1.1: Verify `npm run build` Completes Successfully

**Goal**: Ensure production build works without errors

**Steps**:
1. Run `npm run build` in terminal
2. Check for:
   - TypeScript errors
   - Missing imports
   - Type mismatches
   - Missing dependencies
   - Build warnings
3. Verify output shows:
   - ✅ Compiled successfully
   - ✅ All routes generated
   - ✅ No errors

**Expected Output**:
```
✓ Compiled successfully
✓ Generating static pages (27/27)
✓ Finalizing page optimization
```

**If Errors Found**:
- Document error message
- Identify file and line number
- Research solution (use web search if needed)
- Create fix
- Document in `ERROR_RESOLUTION_LOG.md`

---

### Task 1.2: Verify `npm run dev` Starts Without Errors

**Goal**: Ensure development server starts cleanly

**Steps**:
1. Run `npm run dev`
2. Check terminal for:
   - Server startup messages
   - Compilation errors
   - Missing environment variables
   - Port conflicts
3. Open browser to `http://localhost:3000`
4. Check browser console for:
   - JavaScript errors
   - Network errors
   - Missing resources

**Expected Output**:
```
✓ Ready in 2.5s
○ Compiling / ...
✓ Compiled / in 1.2s
```

**If Errors Found**:
- Document error
- Check environment variables
- Verify dependencies installed
- Fix and document

---

## 🔌 PHASE 2: API ROUTE VERIFICATION

### Task 2.1: Verify All API Routes Exist and Work

**All API Routes to Check** (28 routes):

#### Admin APIs (6 routes)
1. `GET /api/admin/badges` - List all badges
2. `GET /api/admin/users/search` - Search users
3. `GET /api/admin/users/export` - Export users
4. `GET /api/admin/users/[id]` - Get user details
5. `GET /api/admin/users/[id]/badges` - Get user badges
6. `GET /api/admin/users/[id]/roles` - Get user roles

#### Vendor APIs (3 routes)
7. `POST /api/vendor/verify` - Submit vendor application
8. `GET /api/vendor/applications` - List applications
9. `GET /api/vendor/applications/[id]` - Get application details

#### Social APIs (4 routes)
10. `GET /api/posts` - List posts
11. `GET /api/posts/[id]` - Get post details
12. `POST /api/posts/[id]/like` - Like/unlike post
13. `GET /api/posts/[id]/comments` - Get post comments

#### User APIs (2 routes)
14. `POST /api/users/[id]/follow` - Follow/unfollow user
15. `PUT /api/profile/update` - Update profile

#### Booking APIs (2 routes)
16. `POST /api/bookings/create` - Create booking
17. `GET /api/bookings/create` - List bookings
18. `PATCH /api/bookings/update` - Update booking

#### Payment APIs (1 route)
19. `POST /api/payment/create-intent` - Create payment intent

#### Notification APIs (3 routes)
20. `GET /api/notifications` - List notifications
21. `PATCH /api/notifications/[id]/read` - Mark as read
22. `PATCH /api/notifications/read-all` - Mark all as read

#### System APIs (4 routes)
23. `POST /api/upload` - Upload file
24. `POST /api/gamification/update` - Update points/credits
25. `GET /api/health` - Health check
26. `GET /api/health/cache` - Cache health check
27. `GET /api/webhooks/logs` - Webhook logs
28. `POST /api/webhooks/clerk` - Clerk webhook
29. `POST /api/webhooks/stripe` - Stripe webhook

**Verification Steps for Each API**:

1. **Check File Exists**
2. **Check Imports**:
   - ✅ Uses `@/lib/clerk-auth` for authentication
   - ✅ Uses `@/integrations/supabase/server` for database
   - ✅ All imports resolve correctly
   - ✅ No circular dependencies

3. **Check Authentication**:
   - ✅ Protected routes use `getClerkUserId()`
   - ✅ Public routes (webhooks, health) don't require auth
   - ✅ Admin routes check `is_admin` flag

4. **Check Error Handling**:
   - ✅ Try/catch blocks present
   - ✅ Proper error responses
   - ✅ Error logging implemented

5. **Check Response Format**:
   - ✅ Consistent response structure
   - ✅ Proper HTTP status codes
   - ✅ JSON responses

---

## 📄 PHASE 3: PAGE VERIFICATION

### Task 3.1: Verify All Pages Load Without Errors

**All Pages to Check** (33 pages):

#### Public Pages (3 pages)
1. `app/page.tsx` - Landing page
2. `app/(auth)/login/page.tsx` - Login
3. `app/(auth)/register/page.tsx` - Register
4. `app/(auth)/auth/[[...rest]]/page.tsx` - Clerk auth

#### App Pages (26 pages)
5. `app/(app)/home/page.tsx` - Home feed
6. `app/(app)/feed/page.tsx` - Social feed
7. `app/(app)/explore/page.tsx` - Explore
8. `app/(app)/create/page.tsx` - Create post
9. `app/(app)/search/page.tsx` - Search
10. `app/(app)/marketplace/page.tsx` - Marketplace
11. `app/(app)/listing/[id]/page.tsx` - Listing details
12. `app/(app)/cart/page.tsx` - Shopping cart
13. `app/(app)/checkout/page.tsx` - Checkout
14. `app/(app)/orders/page.tsx` - Orders list
15. `app/(app)/order/[id]/page.tsx` - Order details
16. `app/(app)/messages/page.tsx` - Messages
17. `app/(app)/notifications/page.tsx` - Notifications
18. `app/(app)/profile/[id]/page.tsx` - User profile
19. `app/(app)/profile/[id]/edit/page.tsx` - Edit profile
20. `app/(app)/groups/page.tsx` - Groups list
21. `app/(app)/groups/[id]/page.tsx` - Group details
22. `app/(app)/news/page.tsx` - News feed
23. `app/(app)/news/[id]/page.tsx` - News article
24. `app/(app)/rewards/page.tsx` - Rewards/gamification
25. `app/(app)/settings/page.tsx` - Settings
26. `app/(app)/onboarding/page.tsx` - Onboarding funnel
27. `app/(app)/onboarding/vendor/page.tsx` - Vendor onboarding
28. `app/(app)/onboarding/customer/page.tsx` - Customer onboarding

#### Vendor Pages (1 page)
29. `app/(app)/vendor/dashboard/page.tsx` - Vendor dashboard

#### Admin Pages (3 pages)
30. `app/(app)/admin/page.tsx` - Admin dashboard
31. `app/(app)/admin/users/[id]/page.tsx` - User management
32. `app/(app)/admin/realtime-diagnostics/page.tsx` - Realtime testing

---

## 🎨 PHASE 4: UI/UX VERIFICATION

### Task 4.1: Verify Smooth User Experience

**Checklist**:

1. **Loading States**:
   - ✅ All buttons show loading spinners
   - ✅ Forms show loading during submission
   - ✅ Data fetching shows skeleton loaders
   - ✅ No blank screens during loading

2. **Error States**:
   - ✅ Error messages are user-friendly
   - ✅ Errors display in toast notifications
   - ✅ Form validation errors show inline
   - ✅ Network errors are handled gracefully

3. **Success States**:
   - ✅ Success messages appear after actions
   - ✅ Redirects happen after successful operations
   - ✅ Data updates reflect immediately

4. **Responsive Design**:
   - ✅ Works on mobile (375px width)
   - ✅ Works on tablet (768px width)
   - ✅ Works on desktop (1920px width)
   - ✅ Navigation works on all screen sizes

---

## ⚙️ PHASE 5: FUNCTION VERIFICATION

### Task 5.1: Verify All Core Functions Work

**Functions to Verify**:

#### Authentication Functions
- ✅ User sign up
- ✅ User sign in
- ✅ User sign out
- ✅ Admin bypass onboarding

#### Social Functions
- ✅ Create post
- ✅ Like/unlike post
- ✅ Comment on post
- ✅ Follow/unfollow user

#### Marketplace Functions
- ✅ Browse listings
- ✅ Add to cart
- ✅ Checkout
- ✅ View orders

---

## 📝 ERROR RESOLUTION LOG TEMPLATE

Create `ERROR_RESOLUTION_LOG.md` with this format:

```markdown
# Error Resolution Log

## [Date] - [Error Name]

### Error Details
- **Type**: Build Error / Runtime Error / UI Issue
- **Severity**: Critical / High / Medium / Low
- **Location**: File path and line number
- **Error Message**: 
  ```
  [Exact error message]
  ```

### Root Cause
[Detailed explanation of what was causing the error]

### Solution
[Step-by-step solution with code changes]

### How It Works Now
[Explanation of how the fixed code works]

### References
- [Link to documentation]
- [Link to solution source]

---
```

