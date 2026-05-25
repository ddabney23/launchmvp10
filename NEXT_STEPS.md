# Next Steps - Migration Progress

## ✅ Completed

### 1. Prisma Setup
- ✅ Installed Prisma dependencies
- ✅ Created complete Prisma schema from Supabase migrations
- ✅ Fixed schema validation errors
- ✅ Generated Prisma Client successfully
- ✅ Created Prisma client utility (`src/lib/prisma.ts`)

### 2. Next.js Core Setup
- ✅ Updated `next.config.ts` with proper configuration
- ✅ Created `app/` directory structure
- ✅ Created root layout (`app/layout.tsx`)
- ✅ Created providers wrapper (`app/providers.tsx`)
- ✅ Created global styles (`app/globals.css`)
- ✅ Converted all routes to Next.js pages (30+ routes)

### 3. Navigation Components
- ✅ Updated `Navigation.tsx` to use Next.js routing
  - Changed `Link` from `react-router-dom` → `next/link`
  - Changed `useLocation()` → `usePathname()`
  - Changed `useNavigate()` → `useRouter()`
  - Added `'use client'` directive
- ✅ Updated `BottomNavigation.tsx` to use Next.js routing
  - Same changes as Navigation.tsx
  - Added `'use client'` directive

### 4. Core Components
- ✅ Updated `ProtectedRoute.tsx` for Next.js
  - Uses `useRouter()` and `usePathname()` from `next/navigation`
  - Handles redirects with query parameters
  - Added `'use client'` directive
- ✅ Updated `AppLayout.tsx` for Next.js
  - Changed from `<Outlet />` to `{children}`
  - Added `'use client'` directive

### 5. Environment Variables
- ✅ Updated all `import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`
- ✅ Updated Supabase client files
- ✅ Updated analytics, twoFactor, api-mock, envValidation files
- ✅ Updated Settings, Checkout, PushNotificationSettings components

## 🔄 Remaining Tasks

### 1. Update Page Components (High Priority)

The following page components still use React Router and need to be updated:

#### Files that need `useNavigate()` → `useRouter()`:
- `src/pages/Cart.tsx`
- `src/pages/Checkout.tsx`
- `src/pages/Settings.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/CreatePost.tsx`
- `src/pages/Auth.tsx`
- `src/pages/VendorOnboarding.tsx`
- `src/pages/CustomerOnboarding.tsx`
- `src/pages/Index.tsx`
- `src/pages/Home.tsx`
- `src/pages/News.tsx`
- `src/pages/VendorDashboard.tsx`
- `src/pages/Profile.tsx`
- `src/pages/ProfileEdit.tsx`
- `src/pages/OrderDetail.tsx`
- `src/pages/Orders.tsx`
- `src/pages/ListingDetail.tsx`
- `src/pages/Groups.tsx`

#### Files that need `useParams()` updates:
- `src/pages/News.tsx` - Use `params` prop in page component instead
- `src/pages/VendorDashboard.tsx` - Use `params` prop
- `src/pages/Profile.tsx` - Use `params` prop
- `src/pages/ProfileEdit.tsx` - Use `params` prop
- `src/pages/OrderDetail.tsx` - Use `params` prop
- `src/pages/ListingDetail.tsx` - Use `params` prop
- `src/pages/Groups.tsx` - Use `params` prop

#### Files that need `useSearchParams()` updates:
- `src/pages/Auth.tsx` - Use `useSearchParams()` from `next/navigation`
- `src/pages/Search.tsx` - Use `useSearchParams()` from `next/navigation`

#### Files that need `Link` updates:
- `src/pages/Index.tsx`
- `src/pages/Home.tsx`
- `src/pages/Cart.tsx`
- `src/pages/Explore.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/OrderDetail.tsx`
- `src/pages/Orders.tsx`
- `src/pages/ListingDetail.tsx`
- `src/pages/VendorDashboard.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Groups.tsx`

#### Other components:
- `src/components/PostCard.tsx` - Update `useNavigate()` and `Link`
- `src/components/ListingCard.tsx` - Update `Link`
- `src/components/SearchBar.tsx` - Update `useNavigate()`
- `src/components/NotificationsDropdown.tsx` - Update `Link`
- `src/pages/NotFound.tsx` - Update `useLocation()`

### 2. Add 'use client' Directives

Add `'use client'` to the top of these files (they use hooks, browser APIs, or event handlers):

**Pages:**
- All files in `src/pages/` (they all use hooks)

**Components:**
- `src/components/PostCard.tsx`
- `src/components/ListingCard.tsx`
- `src/components/SearchBar.tsx`
- `src/components/NotificationsDropdown.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/TwoFactorSetup.tsx`
- `src/components/TwoFactorVerification.tsx`
- `src/components/BackupCodesManager.tsx`
- `src/components/PushNotificationSettings.tsx`
- `src/components/AuditLogViewer.tsx`
- All components in `src/components/gamification/`
- All components in `src/components/vendor/`

**Contexts:**
- `src/contexts/CartContext.tsx`
- `src/contexts/ThemeProvider.tsx`

**Hooks:**
- All files in `src/hooks/` (they're hooks, so they need 'use client')

### 3. Update Page Components to Use Next.js Params

For dynamic routes, update page components to use the `params` prop:

**Example:**
```tsx
// Before (React Router)
export default function Profile() {
  const { id } = useParams<{ id: string }>();
  // ...
}

// After (Next.js App Router)
export default function Profile({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params;
  // ...
}
```

**Files to update:**
- `app/(app)/profile/[id]/page.tsx`
- `app/(app)/profile/[id]/edit/page.tsx`
- `app/(app)/listing/[id]/page.tsx`
- `app/(app)/order/[id]/page.tsx`
- `app/(app)/groups/[id]/page.tsx`
- `app/(app)/news/[id]/page.tsx`

### 4. Update useAuth Hook

The `useAuth` hook uses `useNavigate()` from React Router. Update it to use Next.js router:

```tsx
// src/hooks/useAuth.tsx
// Change:
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();

// To:
import { useRouter } from "next/navigation";
const router = useRouter();
// Then use router.push() instead of navigate()
```

### 5. Update Image Components (Optional but Recommended)

Replace `<img>` tags with Next.js `<Image>` component for better performance:

```tsx
import Image from 'next/image'

// Replace:
<img src={url} alt="..." />

// With:
<Image src={url} alt="..." width={500} height={500} />
```

### 6. Test the Application

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Test all routes
3. Test authentication flow
4. Test protected routes
5. Test navigation
6. Test API calls

### 7. Remove Vite-Specific Files (After Testing)

Once everything is working:
- `src/main.tsx` (replaced by `app/layout.tsx`)
- `src/App.tsx` (replaced by `app/providers.tsx`)
- `src/lib/router.tsx` (replaced by Next.js file-based routing)
- `src/vite-env.d.ts`
- `vite.config.ts` (if exists)

## 📝 Quick Reference

### Routing Changes

| React Router | Next.js App Router |
|--------------|-------------------|
| `useNavigate()` | `useRouter()` from `next/navigation` |
| `navigate('/path')` | `router.push('/path')` |
| `<Link to="/path">` | `<Link href="/path">` from `next/link` |
| `useParams()` | `params` prop in page component |
| `useSearchParams()` | `useSearchParams()` from `next/navigation` |
| `useLocation()` | `usePathname()` from `next/navigation` |

### Example: Updating a Page Component

```tsx
'use client' // Add this at the top

// Before:
import { useNavigate, useParams, Link } from "react-router-dom";

export default function MyPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  return (
    <Link to="/other">Go</Link>
  );
}

// After:
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter();
  const { id } = params;
  
  return (
    <Link href="/other">Go</Link>
  );
}
```

## 🎯 Priority Order

1. **High Priority:**
   - Update `useAuth` hook (affects many components)
   - Update page components that use `useNavigate()`
   - Add `'use client'` directives to all pages

2. **Medium Priority:**
   - Update components that use React Router
   - Update page components to use `params` prop
   - Update `useSearchParams()` usage

3. **Low Priority:**
   - Update image components
   - Remove Vite-specific files
   - Code cleanup

## 📚 Resources

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Next.js Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Next.js Routing](https://nextjs.org/docs/app/building-your-application/routing)

---

**Last Updated:** $(date)
**Status:** Core migration complete, page components need updates

