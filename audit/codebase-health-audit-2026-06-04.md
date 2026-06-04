# Codebase Health Audit - 2026-06-04

## Executive Summary

This repository is a Next.js 16 App Router marketplace/social application using Supabase Auth/Database, Prisma schema generation, Stripe, Shippo, Upstash Redis, Tailwind, React Query, and Vitest/Jest/Playwright. The application now completes a production `next build`, but it is **not yet production-ready** because `npm run type-check`, `npm run lint`, and the expanded test suite still fail.

## Step 1 - Repository Scan Report

### Broken pages / components
- `/vendor/dashboard` resolved `"dashboard"` as a vendor ID and loaded public vendor mode instead of the owner dashboard.
- `/debug-admin` rendered user/profile JSON without an admin wrapper.
- Several client pages still trigger lint errors from synchronous state updates in effects, including `app/(app)/admin/realtime-diagnostics/page.tsx` and `app/(app)/stories/[userId]/page.tsx`.
- Duplicate/stale components remain: `src/components/ErrorBoundary.tsx` and `src/components/error-boundary.tsx`, plus skeleton component variants.

### Broken API routes
- `POST /api/orders/[orderId]/cancel` referenced non-existent columns (`buyer_id`, `vendor_id`, `total_amount`, `payment_intent_id`, `stock_quantity`) and invalid statuses (`cancelled`).
- `PATCH /api/orders/[orderId]` accepted arbitrary request-body fields and spread them into the `orders` update.
- `GET /api/leaderboard` required authentication and selected non-existent `profiles.full_name` and `profiles.badges`.
- Stripe routes constructed clients at module load, causing `next build` to fail without local Stripe secrets.
- `POST /api/webhooks/shippo` accepted unauthenticated payloads.
- Listing APIs exposed inactive vendor listings to unauthenticated callers.

### Missing / mismatched environment variables
- `env.example.txt` contained real credentials and duplicated filled values.
- Active env validation missed variables used by runtime paths: `DATABASE_URL`, `STRIPE_PRICE_FREE`, `SHIPPO_WEBHOOK_SECRET`, and `VAPID_PRIVATE_KEY`.
- Build previously failed when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` were missing because the browser Supabase client was created eagerly.

### TypeScript errors
- `npm run type-check` still fails. Current representative blockers include:
  - stale Supabase generated types (`Record<string, unknown>` / `never` query results),
  - invalid `.errors` access on Zod v4 errors,
  - incorrect PostgREST `.catch()` usage,
  - Shippo SDK call signature mismatches,
  - schema drift around profile/store/vendor fields.

### Build errors
- Fixed during this audit. `npm run build` now exits successfully.
- Remaining build warnings:
  - Sentry/OpenTelemetry dynamic dependency warning.
  - Upstash Redis warnings when Redis env vars are absent.
  - Next build skips type validation because `next.config.ts` still has `typescript.ignoreBuildErrors: true`.

### Authentication / authorization issues
- Fixed: profile update can no longer self-grant vendor status or credits.
- Fixed: `/debug-admin` uses the existing admin-only route wrapper.
- Remaining: several API routes rely on handler-local checks only; middleware/proxy defense-in-depth does not cover all write/payment/shipping routes.

### Database issues
- Fixed: order cancellation now uses `buyer`, `vendor`, `total`, `stripe_payment_intent`, `order_items`, and `listings.quantity`.
- Remaining: Supabase migration/schema drift remains across `buyer` vs `buyer_id`, `vendor` vs `vendor_id`, and `payout_account_id` vs `stripe_connect_account_id`.
- Prisma exists and generates, but route handlers primarily use Supabase clients; Prisma health is not independently verified.

### Security concerns
- Fixed: committed env template no longer contains live secrets.
- Fixed: Shippo webhook requires HMAC signature verification.
- Fixed: upload route no longer logs full request headers.
- Fixed: inactive listings are no longer returned publicly through vendor filters or direct listing reads.
- Remaining: secrets found in git history must be rotated; history scrubbing was not performed in this branch.
- Remaining: `POST /api/gamification/update` can still be called by users for self-points and should be moved to server-side event awarding.
- Remaining: `GET /api/test-auth` and `GET /api/health/cache` expose operational/auth metadata.

### Performance issues
- Build logs show Upstash warnings when Redis is missing; rate limiting/cache behavior is degraded without Redis.
- Several client pages have React lint findings for effect-driven state updates.
- Sentry/OpenTelemetry dependency warning should be reviewed for bundle/build noise.

## Step 2 - Prioritized Task List

### Critical
1. Rotate exposed Supabase/Resend/Sentry credentials and scrub prior git history.
2. Finish TypeScript cleanup so `npm run type-check` passes without `ignoreBuildErrors`.
3. Reconcile Supabase generated types with the actual live schema and migrations.
4. Move gamification point awards to server-owned events only.
5. Fix Shippo SDK usage and verify shipping labels/rates/track routes with real credentials.

### High
1. Fix lint errors in app/admin/stories/API/scripts and decide whether scripts should be excluded from app ESLint rules.
2. Add a test-server workflow for integration tests or split live-server tests into a separate script.
3. Unify `payout_account_id` and `stripe_connect_account_id` through a migration and code cleanup.
4. Add route-level authorization review for payment, vendor, shipping, upload, booking, profile, and gamification APIs.

### Medium
1. Consolidate duplicate error boundaries and skeleton components.
2. Replace stale Clerk references in comments/docs with Supabase Auth wording.
3. Improve env docs: prefer `env.example.txt`, document Vercel env pull, and clarify optional vs required integrations.
4. Add CI test jobs after tests are made deterministic.

### Low
1. Remove dead/orphaned pages/components after import usage audit.
2. Normalize admin debug tooling into a non-production diagnostics page or remove it.
3. Review Sentry/OpenTelemetry warning and bundle impact.

## Step 3 - Fixes Completed

### Secret-bearing env template
- Problem: `env.example.txt` included real credentials.
- Solution: Replaced it with placeholders only and added missing expected variables.
- Affected files: `env.example.txt`, `src/lib/env.ts`.
- Verification: secret-pattern scan no longer found the removed live keys in `env.example.txt`; `npm audit` now reports no critical vulnerabilities after dependency updates.

### Build-time secret initialization
- Problem: Stripe/Supabase clients were initialized during module import and crashed builds without local secrets.
- Solution: Moved Stripe construction into request handlers after config checks; made the browser Supabase factory build-safe with local placeholders.
- Affected files: payment, vendor, subscription, webhook routes; `src/lib/supabase/client.ts`.
- Verification: `npm run build` passes.

### Order cancellation and update integrity
- Problem: cancel/update routes used wrong columns/statuses and allowed mass assignment.
- Solution: Rewrote cancellation against canonical schema, restored listing quantity via order items, used `canceled`, stored cancellation/refund state in metadata, and whitelisted status updates.
- Affected files: `app/api/orders/[orderId]/cancel/route.ts`, `app/api/orders/[orderId]/route.ts`.
- Verification: build includes both routes successfully; type-check still flags broader Supabase type drift.

### Authorization/data exposure
- Problem: profile updates allowed self-escalation; admin debug data and inactive listings were exposed.
- Solution: Removed user-controlled `is_vendor`/`credits`, gated debug admin page, restricted inactive listing reads to owner/admin.
- Affected files: `app/api/profile/update/route.ts`, `app/(app)/debug-admin/page.tsx`, listing routes.
- Verification: build passes; lint still flags unrelated/pre-existing app issues.

### Stripe Connect and webhooks
- Problem: Connect account reads used inconsistent columns; Shippo webhook was unsigned; Stripe webhook used invalid order status and module-load client.
- Solution: Read/write `payout_account_id` with `stripe_connect_account_id` fallback, added Shippo HMAC verification, changed failed Stripe payments to status `pending` with metadata.
- Affected files: vendor balance/payout/connect routes, order creation route, Shippo/Stripe webhook routes.
- Verification: build passes; full webhook runtime requires provider secrets and signed payloads.

### Test tooling
- Problem: Vitest cache path was Windows-only and existing `tests/unit`/`tests/integration` suites were orphaned.
- Solution: Moved cache to `node_modules/.cache/vitest`, included `tests/unit` and `tests/integration`, and upgraded Vitest packages with the V8 coverage provider.
- Affected files: `vitest.config.ts`, `package.json`, `package-lock.json`.
- Verification: `npm run test` now runs those suites and exposes missing test-server/mocking setup.

## Step 4 - Verification Results

| Check | Status | Evidence |
| --- | --- | --- |
| `npm ci` | Pass | Prisma Client generated successfully. |
| `npm run build` | Pass | Route table generated for all App Router pages/API routes. |
| `npm run type-check` | Fail | `tsc --noEmit` exits 2; current output still lists Supabase type/schema and Zod v4 issues. |
| `npm run lint` | Fail | ESLint exits 1; current output begins with React/effect and `no-explicit-any` errors. |
| `npm run test` | Fail | 7 failures after enabling orphaned suites; failures are `fetch failed` / `ECONNREFUSED :3000` because tests require a server or mocks. |
| `npm audit --audit-level=moderate` | Fail | 9 vulnerabilities remain: 5 moderate, 4 high. Critical vulnerabilities dropped to 0 after Vitest updates. |

Manual browser verification was not performed because the remaining work was backend/config/build focused and no stable authenticated test environment or seeded database was available in this run.

## Step 5 - Final Project Health Report

### Build Status
Passing with warnings. The production build is currently green because `next.config.ts` skips type validation.

### Type Safety Score
Failing gate. Score: **0/100 for CI readiness** until `npm run type-check` passes. The most important root cause is stale/incomplete Supabase generated types and schema drift.

### Security Issues
- Fixed: env template credential exposure, profile privilege escalation, unsigned Shippo webhook, upload header logging, inactive listing exposure, invalid Stripe failed-payment status.
- Remaining: rotate exposed credentials, remove/scrub secrets from git history, server-own gamification awards, reduce public diagnostic leakage, broaden API authorization matrix.

### Performance Recommendations
- Configure Upstash Redis in production or explicitly disable/replace Redis-backed rate limiting/cache warnings.
- Resolve React lint findings for synchronous state updates in effects.
- Review Sentry/OpenTelemetry build warning and whether instrumentation is configured optimally.

### Missing Features / Verification Gaps
- No local `.env.local` or live database credentials were available to verify real database, Stripe, Shippo, or storage operations end-to-end.
- Integration tests need a dev server harness or request mocks.
- E2E tests still likely need stable selectors, test users, and Playwright browser setup.

### Technical Debt
- Stale Supabase types and migration drift.
- Mixed Supabase/Prisma ownership.
- Deprecated/stale Clerk comments and docs.
- Duplicate components and duplicate root/src helper files.
- TypeScript errors hidden by `ignoreBuildErrors`.

### Next Recommended Tasks
1. Rotate all previously committed secrets and invalidate the exposed Supabase service role key.
2. Regenerate Supabase types from the actual schema and fix the highest-volume TypeScript errors.
3. Make `npm run type-check` required by build/CI and remove `ignoreBuildErrors`.
4. Split tests into `test:unit` and `test:integration`, with integration starting Next or using route-handler tests.
5. Complete API authorization matrix and add focused route tests for profile, listings, orders, Stripe, Shippo, uploads, and admin endpoints.
