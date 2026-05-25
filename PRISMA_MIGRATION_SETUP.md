# Prisma Migration Setup (Option 2)

## Current Status

✅ Prisma migrations directory structure created  
✅ Baseline migration created (`0_init`)  
⚠️ Database connection needs to be configured

## Setup Steps

### 1. Fix DATABASE_URL

Make sure your `.env` file has the correct `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

**To get your Supabase connection string:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → Database
3. Copy the "Connection string" under "Connection pooling" or "Direct connection"
4. Replace `[YOUR-PASSWORD]` with your database password

### 2. Mark Baseline Migration as Applied

Since your database already exists with the schema from Supabase migrations, mark the baseline migration as applied:

```bash
npx prisma migrate resolve --applied 0_init
```

This tells Prisma that the initial migration has already been applied to your database.

### 3. Verify Migration Status

Check that everything is in sync:

```bash
npx prisma migrate status
```

You should see:
```
Database schema is up to date!
```

### 4. Future Migrations

When you need to make schema changes:

1. **Update `prisma/schema.prisma`** with your changes
2. **Create a new migration**:
   ```bash
   npm run prisma:migrate -- --name your_migration_name
   ```
3. **Review the generated SQL** in `prisma/migrations/[timestamp]_your_migration_name/migration.sql`
4. **Apply the migration** (automatically done in dev mode):
   ```bash
   npm run prisma:migrate
   ```

### 5. Production Deployment

In production, apply migrations with:

```bash
npm run prisma:migrate:deploy
```

## Important Notes

- **Baseline Migration**: The `0_init` migration is empty because your schema already exists via Supabase migrations
- **Dual Management**: You can continue using Supabase migrations, but Prisma will track changes through its migration system
- **Sync**: Always keep `prisma/schema.prisma` in sync with your actual database schema
- **Backup**: Always backup your database before running migrations in production

## Troubleshooting

### Authentication Error
If you see `P1000: Authentication failed`:
- Check your `DATABASE_URL` in `.env`
- Verify your Supabase database password
- Make sure the connection string format is correct

### Migration Conflicts
If Prisma detects schema drift:
- Run `npx prisma db pull` to introspect the current database
- Update `prisma/schema.prisma` to match
- Create a new migration to sync

### Reset Migrations (Development Only)
If you need to reset migrations in development:
```bash
npx prisma migrate reset
```
⚠️ **Warning**: This will drop your database! Only use in development.

## Next Steps

1. ✅ Fix `DATABASE_URL` in `.env`
2. ✅ Run `npx prisma migrate resolve --applied 0_init`
3. ✅ Verify with `npx prisma migrate status`
4. ✅ Start using Prisma migrations for future schema changes

