# Project Health Audit - 2026-06-04

## Scope

Audited the Next.js App Router application, route handlers, Supabase auth/database integration, Stripe, Shippo, caching/rate limiting, Tailwind UI, package scripts, and test/build configuration.

## Initial findings

### Critical

- `env.example.txt` contained committed live-looking secrets and duplicate filled values.
- Stripe clients were constructed at module load in multiple API routes, causing `next build` to fail when `STRIPE_SECRET_KEY` was absent.
- Supabase middleware crashed every page locally when Supabase public env vars were absent.
- `/debug-admin` exposed sensitive auth/profile debug data to signed-out users.
- Shippo webhook accepted unsigned payloads.

### High

- Marketplace/Search/News pages were public in the app but protected by the proxy route list.
- `/leaderboard` redirect lived under inactive `src/app` instead of the active root `app` tree.
- Cart used the React Router `to` prop on a Next.js `Link`.
- Vendor onboarding could redirect to missing `/vendor`.
- Leaderboard API selected non-existent `profiles.full_name`, `profiles.level`, and `profiles.badges` columns.
- Rewards redemption rejected valid catalog reward IDs because it required UUIDs.
- `app/api/bookings/create` used `createAdminClient()` without importing it.

### Medium / Low

- Invalid Tailwind `bg-linear-to-*` classes prevented gradients from rendering.
- Shared `PageShell` did not account for fixed top/mobile navigation.
- `src/lib/cache.ts` and proxy rate limiting initialized Upstash clients without env-safe fallbacks.
- `vitest.config.ts` used a Windows-only cache path that created an untracked `C:/` directory on Linux.
- Missing `/api/analytics` and `/api/errors` handlers caused client telemetry calls to 404.

## Changes made

- Sanitized `env.example.txt` to placeholders only.
- Added `src/lib/stripe.ts` and migrated Stripe routes/webhook to lazy request-time Stripe initialization.
- Made proxy rate limiting, cache helpers, browser Supabase client, and Supabase middleware safe when optional/local env vars are absent.
- Protected `/debug-admin` with admin auth and removed hardcoded admin email disclosure.
- Aligned UI admin access with `profiles.is_admin` instead of hardcoded/pattern email checks.
- Signed Shippo webhooks with HMAC verification when `SHIPPO_WEBHOOK_SECRET` is configured.
- Added `/api/analytics` and `/api/errors` route handlers.
- Moved `/leaderboard` redirect into active `app/(app)/leaderboard/page.tsx`.
- Fixed Cart links/buttons and vendor onboarding redirects.
- Corrected public proxy route policy for Marketplace/Search/News.
- Fixed leaderboard, bookings, and reward redemption API mismatches.
- Corrected invalid Tailwind gradient classes and `PageShell` nav spacing.
- Changed Vitest cache to `node_modules/.cache/vitest`.

## Verification

- `npm run build`: PASS. All pages/API routes collect and build. Remaining warning is the existing Sentry/OpenTelemetry dynamic dependency warning.
- `npm test`: PASS. 10 test files / 184 tests passed. Existing test warnings remain around React `act(...)` and undefined query data in PostCard tests.
- `npm run lint`: FAIL. Remaining repo-wide lint debt: 310 errors / 278 warnings after fixes, mostly `no-explicit-any`, unescaped entities, and hook/compiler warnings in existing views/routes/tests.
- `npm run type-check`: FAIL. Source/schema type debt remains after the focused fixes, especially Supabase schema drift, old `@ts-expect-error` directives, and view/test type mismatches.
- Browser smoke test: PASS for Marketplace public render, `/leaderboard` redirect to `/rewards` then auth, and `/debug-admin` redirect to auth without debug JSON exposure.

## Current health summary

- Build status: Green with warning.
- Test status: Green for configured Vitest suite.
- Type safety score: Partial. Build still skips type validation, and `npm run type-check` is not green.
- Security status: Improved. Secrets removed from env template, debug page protected, admin UI no longer uses email pattern elevation, Shippo webhook signature support added.
- Database/API status: Improved but not production-complete. Several known schema mismatches remain in orders, reviews, notifications, admin users, and profile update flows.

## Next recommended tasks

1. Finish Supabase schema/type alignment and regenerate/update database types.
2. Fix remaining `npm run type-check` errors, then remove `typescript.ignoreBuildErrors` from `next.config.ts`.
3. Burn down lint errors, starting with production route handlers and shared views.
4. Fix order cancellation/refund schema drift and remove route-handler relative `fetch`.
5. Unify Stripe Connect account columns (`payout_account_id` vs `stripe_connect_account_id`).
6. Decide whether Prisma is a real runtime dependency or should be removed from app health checks/postinstall.
7. Add authenticated integration tests for protected API routes once test Supabase credentials are available.
