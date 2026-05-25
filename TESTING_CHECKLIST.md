# Testing Checklist

## Pre-Testing Setup

### ✅ Environment Variables
- [ ] Created `.env.local` file from `.env.local.example`
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Added `DATABASE_URL` (for Prisma)
- [ ] Verified all values are correct

### ✅ Database Setup
- [ ] All Supabase migrations applied
- [ ] Prisma baseline migration marked as applied: `npx prisma migrate resolve --applied 0_init`
- [ ] Prisma Client generated: `npm run prisma:generate`
- [ ] Migration status verified: `npx prisma migrate status`

## Application Testing

### 1. Start Development Server
```bash
npm run dev
```

**Expected**: Server starts on http://localhost:3000 without errors

### 2. Test Homepage
- [ ] Navigate to http://localhost:3000
- [ ] Page loads without errors
- [ ] No console errors
- [ ] Navigation works

### 3. Test Authentication
- [ ] Navigate to `/auth`
- [ ] Sign up form displays
- [ ] Can create new account
- [ ] Profile is created on signup
- [ ] Redirects to `/onboarding` after signup
- [ ] Can sign in with existing account
- [ ] Redirects to `/home` after signin

### 4. Test Onboarding
- [ ] Onboarding page loads at `/onboarding`
- [ ] Can fill out profile form
- [ ] Can upload avatar
- [ ] Can skip onboarding
- [ ] Redirects to `/home` after completion

### 5. Test Protected Routes
- [ ] `/home` requires authentication
- [ ] `/profile` requires authentication
- [ ] `/settings` requires authentication
- [ ] Unauthenticated users redirected to `/auth`

### 6. Test Admin Dashboard
- [ ] `/admin` accessible only to admin users
- [ ] Recent Registrations section displays
- [ ] All tabs load correctly
- [ ] Can view users, vendors, products

### 7. Test Database Queries
- [ ] No "schema cache" errors in console
- [ ] Profile queries work
- [ ] Posts/queries work
- [ ] Listings load correctly
- [ ] Orders display correctly

### 8. Test Navigation
- [ ] All navigation links work
- [ ] Bottom navigation works
- [ ] Back/forward browser buttons work
- [ ] No 404 errors for valid routes

## Common Issues & Solutions

### Issue: "Missing Supabase environment variables"
**Solution**: 
- Check `.env.local` exists in root directory
- Verify variable names start with `NEXT_PUBLIC_`
- Restart dev server

### Issue: "Could not find the table 'public.profiles'"
**Solution**:
- Verify migrations are applied in Supabase Dashboard
- Restart dev server
- Clear browser cache

### Issue: Prisma authentication errors
**Solution**:
- Check `DATABASE_URL` format
- Verify database password is correct
- Ensure connection string uses correct project reference

### Issue: TypeScript errors
**Solution**:
- Most non-critical errors won't prevent the app from running
- Check console for actual runtime errors
- Fix incrementally if needed

## Success Criteria

✅ All setup steps completed
✅ Development server starts without errors
✅ Authentication flow works end-to-end
✅ Protected routes work correctly
✅ Database queries succeed
✅ No critical console errors
✅ Navigation works smoothly

## Next Steps After Testing

Once testing is complete:
1. Fix any critical issues found
2. Address non-critical TypeScript errors incrementally
3. Set up production environment variables
4. Prepare for deployment

