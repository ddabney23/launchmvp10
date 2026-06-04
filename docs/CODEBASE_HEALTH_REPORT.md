# Codebase Health Report

Audit date: 2026-06-04

## Executive status

- Build status: Passes `npm run build` after fixing import-time integration client initialization.
- Test status: Passes `npm test` (184 Vitest tests).
- Type safety: Failing `npm run type-check`; broad pre-existing API/schema/type debt remains.
- Lint status: Failing `npm run lint`; broad pre-existing lint debt remains.
- Environment status: Failing `npm run verify:env` in this workspace because no local env file is configured.
- Database status: Failing `npm run verify:db` because `DATABASE_URL` is missing.

## Step 1: repository scan findings

### Broken pages and build errors

- `npm run build` initially failed during page data collection for `/api/orders/create-multi-vendor` because `new Stripe(process.env.STRIPE_SECRET_KEY || '')` ran at module import time with no key.
- After fixing Stripe import-time initialization, the build failed for `/` because `src/integrations/supabase/client.ts` created a Supabase browser client at module import time with missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/cache.ts` and root `lib/rate-limit.ts` eagerly constructed Upstash Redis clients with missing env values, producing build-time warnings.
- Final build passes, with only an existing Sentry/OpenTelemetry webpack warning:
  - `Critical dependency: the request of a dependency is an expression`.

### Broken components

- Lint reports React Compiler / hooks issues such as synchronous state updates in effects:
  - `app/(app)/admin/realtime-diagnostics/page.tsx`
  - `app/(app)/stories/[userId]/page.tsx`
- Large UI files still contain many `any` usages, especially `src/views/AdminDashboard.tsx`.
- Automated component tests pass, but some tests emit React `act(...)` warnings for `PostCard` and `useAuth`.

### API route issues

- Many API routes fail type-check because generated Supabase types do not match selected columns or RPC signatures.
- Common route issues:
  - Zod v4 migration mismatch: code reads `error.errors`; current API uses `error.issues`.
  - PostgREST builders are treated like promises in places where `.catch()` is not available.
  - Stale column references such as `full_name`, `phone`, `level`, `badges`, `stock`, and `stripe_connect_account_id`.
  - Several routes pass three arguments to response helpers whose signatures accept fewer arguments.
- Shipping routes used an old Shippo callable/default API while the installed package exposes `new Shippo({ apiKeyHeader })` and camelCase methods.

### Missing API routes

- The test script references `/api/webhooks/clerk`, but no Clerk SDK or Clerk webhook route exists.
- The implemented auth flow is Supabase Auth, not Clerk, despite several `CLERK MIGRATION` comments.

### Missing environment variables

`npm run verify:env` reports these required variables missing in this workspace:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Added `.env.example` with required and optional integration variables for Supabase, Prisma, Stripe, Shippo, Upstash, Cloudinary, Sentry, telemetry, email, and SMS.

### TypeScript errors

`npm run type-check` fails with 894 lines of output. Major categories:

- Supabase schema/type drift and missing columns.
- Zod v4 error shape changes.
- Unknown/never types from untyped Supabase query results.
- Stripe request option typing mismatches in Connect/refund/payout routes.
- Unused `@ts-expect-error` directives.
- Test fixture shape mismatches.

### Authentication and authorization issues

- Requested stack says Clerk, but dependencies do not include `@clerk/nextjs`.
- Runtime implementation uses Supabase Auth (`@supabase/ssr`, `supabase.auth.getUser`, Supabase middleware).
- Several files contain misleading Clerk migration comments.
- Protected routes are enforced through `proxy.ts` and Supabase session refresh, not Clerk middleware.

### Database issues

- Prisma schema exists and Prisma Client generates successfully.
- Database verification cannot connect without `DATABASE_URL`.
- Supabase generated types appear out of sync with application queries and Prisma schema.
- Routes reference tables/columns not represented in the visible Prisma schema/type output, for example shipping labels and subscription/connect fields.

### Security concerns

- `npm audit --omit=dev` reports 5 moderate production advisories through Next/PostCSS and Sentry webpack plugin/uuid transitive dependencies. The suggested automatic fix requires `npm audit fix --force` and would apply breaking dependency changes, so it was not run.
- Security headers are set in `proxy.ts`; CSP still allows `'unsafe-inline'` and `'unsafe-eval'`.
- Root API CORS fallback uses `NEXT_PUBLIC_APP_URL || '*'`, which is broad when unset.
- Service-role Supabase operations require careful route-level authorization; many route typings are currently too weak to prove safety.

### Performance issues

- Build warns through Sentry/OpenTelemetry dynamic require tracing.
- Lint flags synchronous state updates inside effects.
- Some large client views/components should be split and typed to reduce bundle and maintenance risk.
- Redis cache now safely no-ops when unconfigured, but production should configure Upstash to avoid losing cache/rate-limit behavior.

## Step 2: prioritized task list

### Critical

1. Provision and validate env vars for Supabase/Prisma in local, preview, and production.
2. Decide whether auth is Supabase Auth or Clerk; remove conflicting comments/scripts or perform a complete Clerk migration.
3. Regenerate and reconcile Supabase types, Prisma schema, and migrations so API route queries match real database columns/RPCs.
4. Remove `typescript.ignoreBuildErrors` from `next.config.ts` only after type-check is green.

### High

1. Fix Zod v4 validation errors across API routes (`errors` -> `issues`, helper signatures).
2. Fix Stripe Connect/refund/payout route types and confirm runtime field names (`payout_account_id` vs `stripe_connect_account_id`).
3. Fix shipping database schema/type alignment for `shipping_labels`, tracking fields, and order shipping columns.
4. Fix lint errors that can hide runtime bugs, especially React hook/state issues and `any` in API boundaries.

### Medium

1. Replace stale test/script references to Clerk-specific endpoints or implement the missing routes as part of a deliberate Clerk migration.
2. Reduce CSP looseness and configure strict production CORS origins.
3. Address React `act(...)` warnings in component/hook tests.
4. Split large views and remove dead archived/legacy code after confirming references.

### Low

1. Investigate Sentry/OpenTelemetry webpack warning.
2. Consider excluding archived docs/scripts from lint if they are not part of production code.
3. Add focused API integration tests once env/database access is available.

## Step 3: fixes applied

### Fix: import-time Stripe initialization

Problem:

- Payment, subscription, Connect, webhook, refund, payout, and multi-vendor order routes created Stripe clients or threw errors at module import time.
- Missing local `STRIPE_SECRET_KEY` caused `next build` page-data collection to fail before route handlers could return a controlled error.

Solution:

- Added `src/lib/stripe.ts` with lazy `getStripeClient()`.
- Updated Stripe routes to call the helper inside handlers and return explicit configuration errors when Stripe is unset.

Affected files:

- `src/lib/stripe.ts`
- `app/api/orders/create-multi-vendor/route.ts`
- `app/api/payment/create-intent/route.ts`
- `app/api/vendor/balance/route.ts`
- `app/api/vendor/connect/onboard/route.ts`
- `app/api/vendor/connect/status/route.ts`
- `app/api/vendor/payouts/route.ts`
- `app/api/vendor/refund/route.ts`
- `app/api/vendor/subscriptions/checkout/route.ts`
- `app/api/vendor/subscriptions/portal/route.ts`
- `app/api/vendor/subscriptions/route.ts`
- `app/api/webhooks/stripe/route.ts`

Verification:

- `npm run build` no longer fails on `/api/orders/create-multi-vendor` or Stripe webhook collection.

### Fix: Shippo SDK mismatch

Problem:

- Shipping routes imported `shippo` as a callable default and used old method names such as `shipment.create`, `transaction.create`, and `track.get_status`.
- Installed `shippo@2.15.0` exposes `Shippo` class methods such as `shipments.create`, `transactions.create`, and `trackingStatus.get`.

Solution:

- Added `src/lib/shippo.ts` with lazy `getShippoClient()`.
- Updated shipping routes to use the installed SDK API and camelCase response/request fields.
- Tracking now requires a carrier from query params or stored label data because the installed SDK requires carrier plus tracking number.

Affected files:

- `src/lib/shippo.ts`
- `app/api/shipping/labels/route.ts`
- `app/api/shipping/rates/route.ts`
- `app/api/shipping/track/route.ts`

Verification:

- `npm run build` passes with these routes included in the route manifest.

### Fix: import-time Supabase browser client

Problem:

- `src/integrations/supabase/client.ts` exported a browser client created immediately at import time.
- Server build imported it through `/`, causing Supabase to throw when local public env vars were missing.

Solution:

- Updated `src/lib/supabase/client.ts` to validate config at client creation time.
- Updated `src/integrations/supabase/client.ts` to expose a lazy proxy-backed `supabase` export.

Affected files:

- `src/lib/supabase/client.ts`
- `src/integrations/supabase/client.ts`

Verification:

- `npm run build` now prerenders `/` successfully when Supabase env vars are absent.

### Fix: optional Redis cache/rate-limit construction

Problem:

- Root middleware rate-limit and shared cache code eagerly constructed Upstash Redis clients with missing URL/token.

Solution:

- Root `lib/rate-limit.ts` now skips rate limiting when Upstash env vars are absent.
- `src/lib/cache.ts` now treats missing Redis as cache miss/no-op writes and failed cache health.

Affected files:

- `lib/rate-limit.ts`
- `src/lib/cache.ts`

Verification:

- Upstash missing-config warnings are gone from the final successful build output.

### Fix: env documentation

Problem:

- No `.env.example` existed, while `verify:env` requires specific variables.

Solution:

- Added `.env.example` with required and optional integration variables.

Affected files:

- `.env.example`

Verification:

- `npm run verify:env` still fails in this workspace because values are intentionally blank/not provisioned, but the required keys are now documented.

## Step 4: verification results

| Check | Status | Evidence |
| --- | --- | --- |
| `npm run build` | Pass | Build completed and generated 32 static pages plus dynamic API routes. |
| `npm test` | Pass | 10 test files, 184 tests passed. |
| `npm run type-check` | Fail | 894-line output, remaining errors from API/schema/type debt; new helper/cache files no longer appear in errors. |
| `npm run lint` | Fail | Existing lint errors across API routes, views, scripts, and `src/lib/env.ts` parse issue. |
| `npm run verify:env` | Fail | Missing required env vars listed above. |
| `npm run verify:db` | Fail | Prisma cannot run without `DATABASE_URL`. |
| `npm audit --omit=dev` | Fail | 5 moderate production advisories; auto-fix path is breaking. |

Manual GUI responsive verification was not performed because this iteration did not intentionally change rendered UI; the production build validates all pages compile/prerender where applicable.

## Step 5: final project health report

### Build status

Build is green after this audit. Type checking is explicitly skipped by `next.config.ts` via `typescript.ignoreBuildErrors: true`, so build green does not imply type safety.

### Type safety score

Low. A practical score is 35/100 until `npm run type-check` passes and generated database types match real routes.

### Security issues

- Missing env prevents verification of auth/database/Stripe/Shippo in this workspace.
- Auth stack mismatch: requested Clerk, implemented Supabase Auth.
- Production dependency advisories remain.
- CSP/CORS policies need tightening after deployment origins are known.

### Performance recommendations

- Configure Upstash Redis in production for rate limiting/cache.
- Fix React effect lint violations.
- Split very large client views and reduce `any` usage at network boundaries.
- Investigate Sentry/OpenTelemetry webpack dynamic require warning.

### Missing features / unresolved integrations

- Clerk SDK/webhook route are absent.
- UploadThing is requested in the stack but not present in dependencies; current upload route appears Supabase/storage oriented.
- Database, Stripe, Shippo, and protected/admin flows require real envs and seeded data for end-to-end verification.

### Technical debt

- Database schema/type drift is the dominant blocker.
- Archived scripts/docs and legacy comments make ownership unclear.
- Strict TypeScript is enabled but bypassed in production build.
- Tests pass but do not cover many API/database/integration flows.

### Next recommended tasks

1. Pull/provision env vars, then rerun `npm run verify:env`, `npm run verify:db`, and route-level API checks.
2. Regenerate Supabase types and reconcile Prisma schema/migrations with route queries.
3. Fix Zod v4/helper signature errors across API routes.
4. Choose Supabase Auth vs Clerk and make the codebase consistent.
5. Remove `ignoreBuildErrors` after type-check is green.
