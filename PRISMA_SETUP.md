# Prisma Setup Guide

## Overview

This project uses **Prisma** for type-safe database queries alongside **Supabase** for database management. The Prisma schema is generated from your existing Supabase migrations.

## Prisma Scripts

The following scripts have been added to `package.json`:

- `npm run prisma:generate` - Generate Prisma Client (runs automatically on `npm install`)
- `npm run prisma:migrate` - Create a new migration (development)
- `npm run prisma:migrate:deploy` - Apply migrations (production)
- `npm run prisma:push` - Push schema changes without creating migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Setup Options

### Option 1: Use Prisma Only for Type-Safe Queries (Recommended)

Since you're already using Supabase migrations, you can use Prisma only for type-safe queries:

1. **Generate Prisma Client** (already done):
   ```bash
   npm run prisma:generate
   ```

2. **Use Prisma Client in your code**:
   ```typescript
   import { prisma } from '@/lib/prisma'
   
   // Example query
   const users = await prisma.profile.findMany()
   ```

3. **Keep using Supabase migrations** for schema changes - Prisma will stay in sync with your Supabase schema.

### Option 2: Use Prisma Migrations

If you want Prisma to manage migrations:

1. **Create initial migration** (syncs with existing Supabase schema):
   ```bash
   npm run prisma:migrate -- --name init
   ```

2. **For future schema changes**:
   - Update `prisma/schema.prisma`
   - Run: `npm run prisma:migrate -- --name your_migration_name`
   - This will create migration files in `prisma/migrations/`

3. **Apply migrations in production**:
   ```bash
   npm run prisma:migrate:deploy
   ```

## Environment Variables

Make sure you have `DATABASE_URL` set in your `.env` file:

```env
# For Supabase
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Or for local development
DATABASE_URL=postgresql://user:password@localhost:5432/database?schema=public
```

## Current Status

✅ Prisma Client generated  
✅ Prisma schema created from Supabase migrations  
✅ Prisma scripts added to package.json  
✅ Prisma client instance available at `src/lib/prisma.ts`

## Next Steps

1. **If using Option 1** (recommended): You're all set! Just use Prisma Client for queries.

2. **If using Option 2**: Run `npm run prisma:migrate -- --name init` to create the initial migration.

## Important Notes

- The Prisma schema is a **read-only representation** of your Supabase database
- If you change the schema in Supabase, update `prisma/schema.prisma` accordingly
- Always run `npm run prisma:generate` after schema changes
- Prisma Client is automatically generated on `npm install` (via `postinstall` script)

