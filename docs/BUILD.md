# Production build

## Why `npm run build` may mirror your project

Next.js and npm rely on **symlinks and junctions** under `node_modules` and `.next`. On **exFAT** (and some other non-NTFS volumes), Windows returns `EISDIR: illegal operation on a directory, readlink` and the build fails.

This repo’s default build script detects the project drive filesystem:

- **NTFS** (e.g. `C:`): runs `next build --webpack` in place.
- **exFAT / non-NTFS** (e.g. external `O:` OptimixDriv): mirrors to `%LOCALAPPDATA%\optimix-mvp-build` (NTFS on `C:`) and builds there.

You will see a short log line explaining the redirect. Output is also appended to `build-last.log` in the repo root (gitignored).

## Commands

| Script | Purpose |
|--------|---------|
| `npm run build` | Smart build (auto mirror on exFAT) |
| `npm run build:local` | Always build in current directory |
| `npm run build:ntfs` | Force NTFS mirror build |

## Long-term fix

Clone or move the project to an **NTFS** path without spaces, for example:

`C:\dev\optimix-MVP1.0-beta`

Then `npm run build` and `npm run build:local` behave the same.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `EISDIR` / `readlink` on `O:\...` | exFAT project drive | Use `npm run build` (auto mirror) or move repo to NTFS |
| `Module not found` | Missing source file | Restore component under `src/` (see build log) |
| Multiple lockfiles warning | Stray `package-lock.json` in parent folder | Remove unrelated lockfile or keep `outputFileTracingRoot` in `next.config.ts` |
| `npm ci` fails on mirror | Missing `DATABASE_URL` for Prisma postinstall | Ensure `.env.local` exists before build |

## TypeScript

`next.config.ts` sets `typescript.ignoreBuildErrors: true` so legacy TS issues do not block production builds. Run `npm run type-check` separately when tightening types.
