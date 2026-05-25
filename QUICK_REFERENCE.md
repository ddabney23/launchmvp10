# ⚡ Quick Reference Card

**One-page reference for common tasks**

---

## 🚀 First Time Setup

```bash
# 1. Install
npm install

# 2. Create environment file (choose one):
node scripts/setup-env.js        # Interactive wizard
# OR
cp env.example.txt .env.local    # Then edit manually

# 3. Setup database
npm run prisma:generate
npx prisma migrate resolve --applied 0_init

# 4. Verify
npm run verify:all

# 5. Run
npm run dev
```

---

## 📝 Essential Commands

### Development
```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Run production build locally
npm run lint         # Check code style
```

### Database
```bash
npm run prisma:generate        # Generate Prisma Client
npm run prisma:studio          # Open database GUI
npm run prisma:migrate        # Run new migrations
npx prisma migrate status      # Check migration status
npm run verify:db              # Verify all tables exist
```

### Verification
```bash
npm run verify:env    # Check environment variables
npm run verify:db     # Check database tables
npm run verify:all    # Check everything
```

### Health Check
```bash
# Local
curl http://localhost:3000/api/health

# Production
curl https://your-domain.com/api/health
```

---

## 🔑 Environment Variables

### Required (Minimum to Run)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

### Production Required
```env
# Add these for production:
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Get credentials from:**
- Supabase: https://app.supabase.com → Settings → API
- Stripe: https://dashboard.stripe.com → API keys

---

## 📍 Important URLs

### Local Development
- **App**: http://localhost:3000
- **Auth**: http://localhost:3000/auth
- **Admin**: http://localhost:3000/admin
- **Health**: http://localhost:3000/api/health

### API Endpoints
- **Payment**: POST /api/payment/create-intent
- **Webhooks**: POST /api/webhooks/stripe
- **Bookings**: POST /api/bookings/create
- **Health**: GET /api/health

---

## 📚 Documentation Quick Links

| Need | Read |
|------|------|
| Quick start | [START_HERE.md](./START_HERE.md) |
| Full setup | [README.md](./README.md) |
| Environment setup | [env.example.txt](./env.example.txt) |
| API reference | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) |
| User guide | [USER_GUIDE.md](./USER_GUIDE.md) |
| Admin guide | [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) |
| Deployment | [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) |
| All docs | [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) |

---

## 🔧 Common Issues & Fixes

### "Can't connect to database"
```bash
# Check DATABASE_URL in .env.local
# Format: postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
npm run verify:db
```

### "Prisma Client not generated"
```bash
npm run prisma:generate
```

### "Missing environment variables"
```bash
npm run verify:env
# Fix missing variables in .env.local
```

### "Build fails"
```bash
rm -rf .next node_modules
npm install
npm run build
```

### "Health check fails"
```bash
# Check if server is running
npm run dev

# Check health
curl http://localhost:3000/api/health
```

---

## 💳 Testing Payments

### Test Credit Cards
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0027 6000 3184

**Use**: Any future date + any 3-digit CVC

### Test Webhooks Locally
```bash
# Install Stripe CLI
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test payment
stripe trigger payment_intent.succeeded
```

---

## 🎯 Production Deployment

### Pre-Deployment
```bash
# Run all checks
npm run lint
npm run build
npx tsc --noEmit --skipLibCheck
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Post-Deployment
```bash
# Check health
curl https://your-domain.com/api/health

# Should return:
# {"status":"healthy",...}
```

---

## 📊 File Structure

```
my-app/
├── app/                 # Next.js routes
│   ├── api/            # API endpoints ← Payment, Webhooks, Health
│   ├── (app)/          # App routes (protected)
│   └── (auth)/         # Auth routes (public)
├── src/
│   ├── components/     # React components
│   ├── views/          # Page components
│   ├── lib/            # Utilities ← API, types, validators
│   ├── hooks/          # Custom hooks
│   └── contexts/       # React contexts
├── supabase/
│   ├── migrations/     # Database migrations (20 files)
│   └── functions/      # Edge functions
├── scripts/
│   ├── verify-db.ts    # Database verification
│   ├── setup-env.js    # Environment wizard
│   └── deploy.sh       # Deployment script
└── prisma/
    └── schema.prisma   # Database schema
```

---

## 🎓 Learning Resources

### Day 1: Setup
1. Run setup commands above
2. Read START_HERE.md
3. Create test account

### Day 2: Explore
1. Browse all features
2. Read USER_GUIDE.md
3. Test shopping & bookings

### Week 1: Develop
1. Read CONTRIBUTING.md
2. Read API_DOCUMENTATION.md
3. Make first contribution

---

## 🆘 Getting Help

### Documentation
- **Index**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **All 27 docs**: In root directory

### Scripts
```bash
node scripts/setup-env.js      # Setup environment
npm run verify:all             # Verify everything
npm run dev                    # Start development
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

---

## ✅ Success Checklist

Before considering setup complete:

- [ ] `.env.local` file created and filled
- [ ] `npm run verify:env` passes
- [ ] All 20 Supabase migrations applied
- [ ] `npm run verify:db` passes
- [ ] `npm run dev` starts without errors
- [ ] Can access http://localhost:3000
- [ ] Can create account at `/auth`
- [ ] `/api/health` returns "healthy"
- [ ] No console errors in browser

**When all checked**: ✅ **YOU'RE READY!**

---

## 🚀 Next Actions

1. **Run this now**:
```bash
node scripts/setup-env.js
```

2. **Then run**:
```bash
npm run verify:all
npm run dev
```

3. **Open browser**: http://localhost:3000

4. **Read**: [USER_GUIDE.md](./USER_GUIDE.md) to learn all features

---

**Status**: 🎯 Everything is ready - just run the setup!  
**Time**: 15-20 minutes from zero to running  
**Support**: See DOCUMENTATION_INDEX.md for all guides

