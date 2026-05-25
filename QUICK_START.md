# Quick Start Guide

## 🚀 Get Your App Running in 5 Minutes

### Step 1: Set Up Environment Variables (2 minutes)

1. **Create `.env.local` file** in the root directory:
   ```bash
   # Copy the example file
   cp .env.local.example .env.local
   ```

2. **Get your Supabase credentials**:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Go to **Settings** → **API**
   - Copy:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Get your Database URL**:
   - In Supabase Dashboard, go to **Settings** → **Database**
   - Copy the **Connection string** (URI format)
   - Replace `[YOUR-PASSWORD]` with your database password
   - Use as `DATABASE_URL`

4. **Update `.env.local`** with your actual values

### Step 2: Verify Database Setup (1 minute)

1. **Check Supabase Migrations**:
   - Go to Supabase Dashboard → Database → Migrations
   - Ensure all migrations are "Applied"
   - If not, apply them via SQL Editor

2. **Set up Prisma**:
   ```bash
   # Mark baseline migration as applied
   npx prisma migrate resolve --applied 0_init
   
   # Verify status
   npx prisma migrate status
   
   # Generate Prisma Client
   npm run prisma:generate
   ```

### Step 3: Start the App (1 minute)

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

### Step 4: Test (1 minute)

1. Open http://localhost:3000
2. Navigate to `/auth`
3. Try creating an account
4. Check browser console for errors

## ✅ Success Checklist

- [ ] `.env.local` file created with correct values
- [ ] All Supabase migrations applied
- [ ] Prisma baseline migration marked as applied
- [ ] `npm run dev` starts without errors
- [ ] Can navigate to `/auth` page
- [ ] No console errors on page load

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Check that `.env.local` exists in root directory
- Verify variable names start with `NEXT_PUBLIC_`
- Restart dev server after adding env vars

### "Could not find the table 'public.profiles'"
- Verify migrations are applied in Supabase Dashboard
- Restart dev server
- Clear browser cache

### Prisma authentication errors
- Check `DATABASE_URL` format
- Verify database password is correct
- Ensure connection string uses correct project reference

## 📚 Need More Help?

- See `SETUP_PROGRESS.md` for detailed progress
- See `ENV_SETUP.md` for environment variable details
- See `SETUP_CHECKLIST.md` for complete verification checklist

