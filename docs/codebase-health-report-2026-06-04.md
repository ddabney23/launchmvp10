# Codebase Health Report - 2026-06-04

## Executive Summary

This repository is a Next.js 16 App Router social-commerce application. The requested stack lists Clerk, UploadThing, and Zustand, but the active runtime implementation uses Supabase Auth, Supabase Storage, React Context, TanStack Query, Prisma only for tooling/verification, Stripe, Shippo, and Upstash.

The audit found confirmed production blockers and security issues. This pass fixed the highest-risk items that could be safely remediated without replacing the active architecture or duplicating functionality.

## Step 1 - Scan Findings

### Broken Pages / Components

- `src/app/leaderboard/page.tsx` was an orphaned duplicate App Router tree. The real app root is `/app`, so this route was not mounted.
- `/debug-admin` exposed raw user/profile JSON and hardcoded admin rules without route protection.
- `Profile` avatar upload omitted `credentials: 'include'`, making authenticated uploads unreliable.
- `/` used the browser Supabase client factory from a Server Component.

### API Route Issues

- Multiple Stripe routes created `new Stripe(...)` at module scope. Missing `STRIPE_SECRET_KEY` caused `next build` to fail while collecting route data before handlers could return a configured error.
- `/api/test-auth` was public via proxy and returned diagnostic session/cookie metadata.
- `/api/leaderboard` converted unauthenticated access into a 500 and selected a non-existent `profiles.full_name` column.
- Several sensitive API prefixes were not protected at the proxy boundary and relied only on handler-level auth.

### Missing Environment Variables

`npm run verify:env` reports these required variables missing in this workspace:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Production feature variables also required for complete functionality:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`, subscription price IDs
- Shippo: `SHIPPO_API_KEY`
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### TypeScript / Lint / Build

- Baseline `npm run type-check`: over 500 TypeScript error lines.
- Post-fix `npm run type-check`: over 500 TypeScript error lines remain.
- Baseline/post-fix lint: 593 problems, 314 errors, 279 warnings.
- `next.config.ts` still sets `typescript.ignoreBuildErrors: true`, so production build skips type validation.
- With missing env vars, `npm run build` fails during prerender because Supabase URL/key are required.
- With non-secret placeholder Supabase env values, `npm run build` completes successfully after the Stripe fix.

### Authentication / Authorization Issues

- Runtime auth is Supabase, not Clerk.
- Hardcoded client-side admin email/pattern bypass existed in `src/lib/admin.ts`.
- `/debug-admin` and `/api/test-auth` exposed diagnostics.
- `ProtectedRoute` and UI navigation used the hardcoded email helper, while API admin routes use `profiles.is_admin`, causing inconsistent admin behavior.

### Database / Schema Issues

- Runtime database access uses Supabase clients; Prisma is only used by scripts/generation.
- Supabase generated types and SQL migrations appear out of sync with application queries, causing many type errors.
- Legacy Clerk-oriented migrations/docs remain and can confuse or break RLS if applied out of order.

### Security Concerns

- `env.example.txt` contained duplicated live-looking Supabase, Sentry, GA, and Resend credentials.
- `/api/profile/update` allowed authenticated users to set `credits` and `is_vendor` through a service-role admin client.
- Service-role Supabase usage is widespread, so route-level authorization must remain strict.
- npm audit reports 11 vulnerabilities: 5 moderate, 4 high, 2 critical.

### Performance / Reliability Issues

- Cache/rate-limit modules constructed Upstash clients even when Redis env vars were absent, producing warnings during build.
- Sentry/OpenTelemetry emits a webpack critical dependency warning.
- Checkout creates PaymentIntents but the UI still does not collect payment through Stripe Elements/Checkout.

## Step 2 - Prioritized Task List

### Critical

1. Rotate leaked secrets that were present in `env.example.txt` history.
2. Remove client-side privilege escalation from `/api/profile/update`.
3. Protect debug/auth diagnostic surfaces.
4. Fix Stripe module-scope initialization build failures.

### High

1. Provide real environment variables in Vercel/local `.env.local`.
2. Resolve Supabase schema/type drift and remove `ignoreBuildErrors`.
3. Complete Stripe checkout payment collection UI.
4. Remove or reconcile legacy Clerk migrations/docs.
5. Review service-role usage route by route.

### Medium

1. Consolidate rate-limit/cache behavior.
2. Add segment `error.tsx` / `loading.tsx` for critical pages.
3. Complete API integration tests for authenticated flows.
4. Resolve npm audit vulnerabilities with compatible package updates.

### Low

1. Remove stale comments that mention Clerk.
2. Add per-page metadata.
3. Reduce duplicate historical docs and prior report artifacts.

## Step 3 - Fixes Applied

### Security hardening

- Replaced `env.example.txt` live-looking credentials with placeholders.
- Removed user-writable `credits` and `is_vendor` from `/api/profile/update`.
- Changed admin helper to no longer grant admin access by hardcoded email or `admin@` patterns.
- Wrapped `/debug-admin` in `ProtectedRoute requireAdmin` and removed raw JSON dumps.
- Made `/api/test-auth` require auth and return minimal diagnostic output.

### Route and API hardening

- Expanded proxy protection for `/debug-admin`, `/order/*`, `/stories/*`, and sensitive API prefixes such as orders, payment, profile, vendor, shipping, notifications, leaderboard, and test-auth.
- Changed proxy CORS fallback from wildcard to same-origin when `NEXT_PUBLIC_APP_URL` is absent.
- Improved write-operation detection for rate limiting by HTTP method.

### Build/runtime fixes

- Added `src/lib/stripe.ts` with request-time Stripe client creation.
- Updated payment, order, vendor Stripe, subscription, Connect, payout, refund, balance, and webhook routes to avoid build-time Stripe construction.
- Made Redis cache/rate-limit modules no-op gracefully when Upstash env vars are missing.
- Switched landing-page news fetch to the server Supabase client.
- Removed orphan `src/app/leaderboard/page.tsx`.
- Fixed `/api/leaderboard` to use `display_name` and return 401 for missing auth.
- Added credentials to profile avatar upload.

## Step 4 - Verification

Commands run after fixes:

| Command | Result |
| --- | --- |
| `npm run verify:env` | Fails: required Supabase/DB env vars are missing in this workspace |
| `npm run type-check` | Fails: over 500 TypeScript error lines remain |
| `npm run lint` | Fails: 593 problems remain |
| `npm run build` | Fails without env; passes with non-secret placeholder Supabase env values |
| `npm run test` | Passes: 10 files, 184 tests |
| `npm audit --audit-level=moderate` | Fails: 11 vulnerabilities |

Successful build command used to isolate code correctness from missing secrets:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
SUPABASE_SERVICE_ROLE_KEY=dummy-service-role \
npm run build
```

## Step 5 - Final Project Health

- **Build Status:** Code builds with required env placeholders; actual workspace build fails until required env vars are configured.
- **Type Safety Score:** Low. TypeScript is currently not production-enforced because `ignoreBuildErrors` is enabled and over 500 TypeScript error lines remain.
- **Security Issues:** Critical leaked secrets require rotation; service-role route authorization needs a full audit; npm vulnerabilities remain.
- **Performance Recommendations:** Keep Upstash configured in production for rate limiting/cache; investigate Sentry/OpenTelemetry webpack warning; add loading/error boundaries.
- **Missing Features:** Stripe payment collection UI, UploadThing/Clerk/Zustand if those remain product requirements, authenticated API E2E coverage.
- **Technical Debt:** Supabase type/schema drift, legacy Clerk artifacts, duplicate historical docs, broad lint backlog.
- **Next Recommended Tasks:** Configure/rotate env vars, regenerate Supabase types from the live schema, eliminate TypeScript errors by domain, complete Stripe checkout UI, then re-enable type checking in Next builds.

