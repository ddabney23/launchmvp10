# Codebase Health Report

## Scope

Audit performed on the Next.js App Router application with TypeScript, Tailwind, Supabase Auth, Prisma/PostgreSQL tooling, Stripe, Shippo, and Vercel-oriented deployment configuration.

## Key findings

### Critical

- `env.example.txt` contained committed live-looking credentials for Supabase, database, Sentry, and Resend. These values were removed from the template, but any exposed credentials must be rotated because they remain in git history.
- Production build failed without `STRIPE_SECRET_KEY` because multiple API route modules instantiated Stripe at import time.
- Runtime page loads failed without Supabase env vars because proxy session refresh always constructed a Supabase server client.
- Shippo webhook accepted unsigned payloads.

### High

- `next.config.ts` still has `typescript.ignoreBuildErrors: true`, masking type failures during `npm run build`.
- `npm run type-check` fails from a large existing backlog: Supabase generated-type drift, Zod v4 `.issues` migration issues, invalid PostgREST `.catch()` chains, Shippo SDK typing mismatches, and stale schema references.
- `npm run lint` fails from a large existing backlog: explicit `any`, script `require()` usage, unused variables, and React hook warnings.
- Required local env vars are absent in this environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- API/page protection in `proxy.ts` was incomplete for several authenticated surfaces.

### Medium

- Admin news uploads used a `news` bucket that the upload API rejected.
- Upload API logged all request headers, which can leak cookies/auth tokens in logs.
- Notifications page linked order notifications to `/orders/[id]`, but the active route is `/order/[id]`.
- Vitest cache path was hard-coded to a Windows user directory and created `C:/...` artifacts on Linux.
- NPM audit reports 11 vulnerabilities: 5 moderate, 4 high, 2 critical.

## Changes made

- Added a lazy shared Stripe helper (`src/lib/stripe.ts`) and updated Stripe-backed routes to fail requests clearly when Stripe is unconfigured instead of breaking builds.
- Made the homepage Supabase fetch use a server-safe Supabase JS client after env validation.
- Made browser Supabase client construction and proxy session refresh safe when local env vars are missing.
- Removed exposed credentials and duplicated content from `env.example.txt`.
- Added Shippo HMAC verification using `Shippo-Auth-Signature`/compatible headers before JSON parsing.
- Removed sensitive upload header logging, added strict upload form-field checks, and allowed the existing `news` bucket.
- Expanded proxy protection for high-risk app/API routes and limited public listing API access to explicit GET reads.
- Fixed notification order links to use `/order/[id]`.
- Moved Vitest cache to `./node_modules/.vite/vitest`.
- Added unit tests for Stripe helper and Shippo webhook signature verification.

## Verification results

- `npm run build`: Passes. Remaining warnings: Sentry/OpenTelemetry dynamic import warning and missing Upstash env warnings.
- `npm test -- --run`: Passes, 12 test files / 188 tests. Existing test-console warnings remain for expected JSON parse errors and React `act(...)` warnings.
- Browser smoke test: Passes. Homepage renders without error overlay; `/order/test-order-id` and `/notifications` redirect to `/auth?redirect_url=...`.
- `npm run verify:env`: Fails because required local env vars are not present in this environment.
- `npm run verify:db`: Not reached because `verify:env` fails first; database verification requires `DATABASE_URL`.
- `npm run lint`: Still fails from the pre-existing lint backlog.
- `npm run type-check`: Still fails from the pre-existing type backlog.

## Next recommended tasks

1. Rotate all credentials that appeared in `env.example.txt` and audit git history.
2. Pull/provision environment variables, then run `npm run verify:env` and `npm run verify:db`.
3. Regenerate/fix Supabase TypeScript types to match the live schema, then remove `typescript.ignoreBuildErrors`.
4. Fix Zod v4 validation errors (`.errors` -> `.issues`) and invalid PostgREST query patterns.
5. Resolve Shippo SDK type usage in shipping routes.
6. Decide and document the active auth model: current runtime is Supabase Auth, while Clerk-era comments/scripts/schema fields remain.
7. Address npm audit vulnerabilities with dependency upgrades and regression testing.
8. Add end-to-end tests for authentication redirects, upload bucket validation, Stripe payment route configuration failures, and webhook signature rejection.
