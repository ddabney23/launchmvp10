# Migration Guide: Vite → Next.js + Supabase → Prisma

This document outlines the complete migration from Vite/React Router to Next.js and the addition of Prisma schema.

## ✅ Completed Steps

### 1. Prisma Setup
- ✅ Installed Prisma dependencies (`prisma`, `@prisma/client`)
- ✅ Initialized Prisma (`npx prisma init`)
- ✅ Created complete Prisma schema from all Supabase migrations
- ✅ Schema includes all tables: profiles, posts, listings, orders, bookings, messages, notifications, badges, vendor profiles, groups, stores, transactions, payouts, reviews, coupons, news, 2FA, push subscriptions, audit logs, and more

### 2. Next.js Setup
- ✅ Updated `next.config.ts` with proper configuration
- ✅ Created `app/` directory structure
- ✅ Created root layout (`app/layout.tsx`)
- ✅ Created providers wrapper (`app/providers.tsx`)
- ✅ Created global styles (`app/globals.css`)

### 3. Route Conversion
All routes have been converted from React Router to Next.js App Router:

**Auth Routes:**
- `/login` → `app/(auth)/login/page.tsx`
- `/register` → `app/(auth)/register/page.tsx`

**App Routes:**
- `/` → `app/page.tsx`
- `/home` → `app/(app)/home/page.tsx`
- `/feed` → `app/(app)/feed/page.tsx`
- `/create` → `app/(app)/create/page.tsx`
- `/search` → `app/(app)/search/page.tsx`
- `/explore` → `app/(app)/explore/page.tsx`
- `/marketplace` → `app/(app)/marketplace/page.tsx`
- `/listing/[id]` → `app/(app)/listing/[id]/page.tsx`
- `/cart` → `app/(app)/cart/page.tsx`
- `/checkout` → `app/(app)/checkout/page.tsx`
- `/orders` → `app/(app)/orders/page.tsx`
- `/order/[id]` → `app/(app)/order/[id]/page.tsx`
- `/profile/[id]` → `app/(app)/profile/[id]/page.tsx`
- `/profile/[id]/edit` → `app/(app)/profile/[id]/edit/page.tsx`
- `/groups` → `app/(app)/groups/page.tsx`
- `/groups/[id]` → `app/(app)/groups/[id]/page.tsx`
- `/rewards` → `app/(app)/rewards/page.tsx`
- `/notifications` → `app/(app)/notifications/page.tsx`
- `/messages` → `app/(app)/messages/page.tsx`
- `/admin` → `app/(app)/admin/page.tsx`
- `/settings` → `app/(app)/settings/page.tsx`
- `/vendor/dashboard` → `app/(app)/vendor/dashboard/page.tsx`
- `/onboarding` → `app/(app)/onboarding/page.tsx`
- `/onboarding/vendor` → `app/(app)/onboarding/vendor/page.tsx`
- `/onboarding/customer` → `app/(app)/onboarding/customer/page.tsx`
- `/news` → `app/(app)/news/page.tsx`
- `/news/[id]` → `app/(app)/news/[id]/page.tsx`

### 4. Environment Variables
- ✅ Updated all `import.meta.env.VITE_*` to `process.env.NEXT_PUBLIC_*`
- ✅ Updated Supabase client files
- ✅ Updated analytics, twoFactor, api-mock, envValidation files
- ✅ Updated Settings, Checkout, PushNotificationSettings components

## 📋 Next Steps

### 1. Environment Variables Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Database (for Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/database?schema=public
# Or for Supabase:
# DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Stripe (Optional)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=your_stripe_public_key

# Push Notifications (Optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key

# Error Tracking (Optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_ERROR_TRACKING_SERVICE=console

# App Configuration (Optional)
NEXT_PUBLIC_APP_NAME=My App
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. (Optional) Push Prisma Schema to Database

If you want Prisma to manage your database schema:

```bash
npx prisma db push
```

Or create a migration:

```bash
npx prisma migrate dev --name init
```

**Note:** Since you're already using Supabase migrations, you may want to keep using Supabase for schema management and use Prisma only for type-safe queries. In that case, skip this step.

### 4. Update Components for Next.js

Some components may need updates:

1. **Client Components**: Add `'use client'` directive to components that use:
   - React hooks (useState, useEffect, etc.)
   - Browser APIs (window, localStorage, etc.)
   - Event handlers
   - Context providers

2. **Routing**: Replace React Router navigation:
   - `useNavigate()` → `useRouter()` from `next/navigation`
   - `<Link>` from `react-router-dom` → `<Link>` from `next/link`
   - `useParams()` from `react-router-dom` → `useParams()` from `next/navigation` (in App Router, use `params` prop in page components)

3. **Images**: Replace `<img>` with Next.js `<Image>` component:
   ```tsx
   import Image from 'next/image'
   ```

### 5. Update Navigation Components

Check these files and update routing:
- `src/components/Navigation.tsx`
- `src/components/BottomNavigation.tsx`
- Any other components using React Router

### 6. Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test all routes
3. Test authentication flow
4. Test protected routes
5. Test API calls
6. Test database queries (if using Prisma)

### 7. Remove Vite-Specific Files (After Testing)

Once everything is working:
- `src/main.tsx` (replaced by `app/layout.tsx`)
- `src/App.tsx` (replaced by `app/providers.tsx`)
- `src/lib/router.tsx` (replaced by Next.js file-based routing)
- `vite.config.ts` (if exists)
- `src/vite-env.d.ts`

## 🔧 Important Notes

### Prisma vs Supabase

You can use both Prisma and Supabase together:
- **Supabase**: Use for authentication, realtime subscriptions, storage, and Edge Functions
- **Prisma**: Use for type-safe database queries and migrations (optional)

### Client vs Server Components

- **Server Components** (default): Can't use hooks, browser APIs, or event handlers
- **Client Components**: Must have `'use client'` directive at the top

### Environment Variables

- Client-side: Must use `NEXT_PUBLIC_*` prefix
- Server-side: Can use any name (no prefix needed)
- Access: `process.env.NEXT_PUBLIC_*` (not `import.meta.env`)

### Routing Differences

| React Router | Next.js App Router |
|--------------|-------------------|
| `useNavigate()` | `useRouter()` from `next/navigation` |
| `<Link to="/path">` | `<Link href="/path">` from `next/link` |
| `useParams()` | `params` prop in page component |
| `useSearchParams()` | `useSearchParams()` from `next/navigation` |

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 🐛 Troubleshooting

### Issue: Environment variables not working
- Make sure they're prefixed with `NEXT_PUBLIC_*` for client-side
- Restart the dev server after adding new env vars
- Check `.env.local` is in the root directory

### Issue: Components not rendering
- Check if component needs `'use client'` directive
- Verify imports are correct
- Check browser console for errors

### Issue: Routing not working
- Verify file structure matches route structure
- Check if using correct Next.js navigation hooks
- Ensure page components are default exports

### Issue: Prisma client not found
- Run `npx prisma generate`
- Check `DATABASE_URL` is set correctly
- Verify Prisma schema is valid

## ✅ Migration Checklist

- [x] Install Prisma
- [x] Create Prisma schema
- [x] Update Next.js config
- [x] Create app directory structure
- [x] Convert all routes
- [x] Update environment variables
- [x] Update Supabase client
- [ ] Update navigation components
- [ ] Add 'use client' directives where needed
- [ ] Update image components
- [ ] Test all routes
- [ ] Test authentication
- [ ] Test protected routes
- [ ] Remove Vite-specific files
- [ ] Update package.json scripts (if needed)
- [ ] Deploy to production

---

**Migration completed on:** $(date)
**Next.js version:** 16.0.1
**Prisma version:** Latest

