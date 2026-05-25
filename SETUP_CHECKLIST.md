# Setup Checklist - Complete Next.js + Supabase + Prisma Setup

Use this checklist to ensure everything is properly configured.

## ✅ Prerequisites

- [ ] Node.js installed (v18+)
- [ ] npm or yarn installed
- [ ] Supabase project created
- [ ] Database password known

## 📋 Environment Variables

- [ ] Created `.env.local` file in root directory
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Added `DATABASE_URL` (for Prisma)
- [ ] Verified all environment variables are correct
- [ ] Restarted dev server after adding env vars

**See**: [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions

## 🗄️ Database Setup

### Supabase Migrations
- [ ] All migrations in `supabase/migrations/` are applied
- [ ] Verified in Supabase Dashboard → Database → Migrations
- [ ] `profiles` table exists and has correct columns
- [ ] All other tables exist (posts, comments, likes, listings, orders, etc.)

### Prisma Setup (Option 2)
- [ ] Prisma Client generated: `npm run prisma:generate`
- [ ] Baseline migration marked as applied: `npx prisma migrate resolve --applied 0_init`
- [ ] Migration status verified: `npx prisma migrate status` shows "up to date"
- [ ] Prisma schema matches Supabase schema

## 🔧 Code Setup

### TypeScript Types
- [ ] ✅ Supabase types updated (`src/integrations/supabase/types.ts`)
- [ ] Types match database schema
- [ ] No TypeScript errors in types file

### Configuration Files
- [ ] `next.config.ts` configured correctly
- [ ] `postcss.config.mjs` configured for Tailwind CSS v4
- [ ] `tsconfig.json` paths configured correctly
- [ ] `package.json` scripts updated

## 🧪 Testing

### Authentication
- [ ] Can navigate to `/auth`
- [ ] Can create new account
- [ ] Can sign in with existing account
- [ ] Profile is created on signup
- [ ] Redirects to onboarding after signup

### Onboarding
- [ ] Onboarding page loads at `/onboarding`
- [ ] Can complete profile setup
- [ ] Can skip onboarding (creates minimal profile)
- [ ] Redirects to `/home` after completion

### Admin Dashboard
- [ ] Can access `/admin` (as admin user)
- [ ] Recent Registrations section shows new users
- [ ] All tabs load correctly
- [ ] Can view users, vendors, products, etc.

### Database Queries
- [ ] No "schema cache" errors in console
- [ ] Profile queries work
- [ ] Posts/queries work
- [ ] No TypeScript errors related to database types

## 🚀 Development Server

- [ ] `npm run dev` starts without errors
- [ ] No console errors on page load
- [ ] Pages render correctly
- [ ] Navigation works
- [ ] No hydration errors

## 📝 Documentation

- [ ] Read [NEXT_STEPS_COMPLETE.md](./NEXT_STEPS_COMPLETE.md)
- [ ] Read [ENV_SETUP.md](./ENV_SETUP.md)
- [ ] Read [PRISMA_MIGRATION_SETUP.md](./PRISMA_MIGRATION_SETUP.md)
- [ ] Read [SUPABASE_SCHEMA_FIX.md](./SUPABASE_SCHEMA_FIX.md)

## 🎯 Quick Verification Commands

```bash
# Check Prisma Client is generated
npm run prisma:generate

# Check Prisma migration status
npx prisma migrate status

# Validate Prisma schema
npx prisma validate

# Start dev server
npm run dev

# Check for TypeScript errors
npx tsc --noEmit
```

## ⚠️ Common Issues & Solutions

### Issue: "Could not find the table 'public.profiles' in the schema cache"
**Solution**: 
1. Verify migrations are applied
2. Restart dev server
3. Clear browser cache/localStorage

### Issue: Prisma authentication errors
**Solution**:
1. Check `DATABASE_URL` in `.env.local`
2. Verify database password is correct
3. Check connection string format

### Issue: Type mismatches
**Solution**:
1. Types have been updated - restart dev server
2. If issues persist, regenerate types from Supabase

## ✅ Final Steps

Once all items are checked:

1. **Test the full flow**:
   - Sign up → Onboarding → Home
   - Create a post
   - Browse marketplace
   - Test admin features

2. **Verify in production** (when ready):
   - Set production environment variables
   - Run `npm run build`
   - Test production build locally: `npm run start`

3. **Deploy**:
   - Deploy to your hosting platform
   - Set environment variables in hosting platform
   - Run `npm run prisma:migrate:deploy` in production

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)

