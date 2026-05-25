# 🚀 Optimix - Social Commerce Platform

A modern, full-featured social commerce platform built with Next.js, Clerk, Supabase, and Stripe.

## ✨ Features

### Core Features
- 🛍️ **E-commerce**: Full shopping cart, checkout, and order management
- 📅 **Bookings System**: Service booking with calendar integration
- 💳 **Payments**: Secure payment processing via Stripe
- 👥 **Social**: Posts, comments, likes, following, messaging
- 🏆 **Gamification**: Points, badges, credits, and leaderboards
- 📊 **Vendor Platform**: Seller dashboard, analytics, and management
- 🔐 **Authentication**: Clerk-hosted auth with 2FA + social sign-in
- 📱 **Mobile Responsive**: Optimized for all devices

### Admin Features
- User management and moderation
- Vendor approval system
- Content moderation tools
- Analytics and reporting
- Order management
- Gamification configuration

---

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via [Supabase](https://supabase.com/)
- **ORM**: Prisma
- **Authentication**: [Clerk](https://clerk.com/) (primary authentication provider with 2FA support) + Supabase (data storage)
- **Payments**: [Stripe](https://stripe.com/)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **State Management**: React Query (TanStack Query)
- **Form Handling**: React Hook Form + Zod
- **Deployment**: Vercel (recommended)

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Clerk account** (for authentication + user management)
- **Supabase account** (free tier works)
- **Stripe account** (test mode for development)
- **Upstash Redis** (or Vercel KV) for rate limiting tokens
- **Git** for version control

---

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/optimix.git
cd optimix
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp ENV_TEMPLATE.md .env.local
```


Fill in your credentials (see [Environment Setup](#environment-setup) below).

### 4. Configure Clerk Authentication

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) → Create application
2. Add allowed origins: `http://localhost:3000` (plus your deployed domains)
3. Copy **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Copy **Secret key** → `CLERK_SECRET_KEY`
5. (Optional) Update redirect URLs:
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/home`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding`
6. Add the Clerk middleware to your routes if deploying to new domains (see `src/middleware.ts`)

### 5. Set Up Database

#### Apply Supabase Migrations

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project (or use existing)
3. Go to **Database** → **Migrations**
4. Apply all migrations from `supabase/migrations/`

#### Set Up Prisma

```bash
# Generate Prisma Client
npm run prisma:generate

# Mark baseline migration as applied (for existing database)
npx prisma migrate resolve --applied 0_init

# Verify migration status
npx prisma migrate status
```

### 6. Verify Setup

```bash
# Run database verification script
npx ts-node scripts/verify-db.ts
```

### 7. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

---

## 🔧 Environment Setup

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/home
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# App Configuration
NEXT_PUBLIC_APP_NAME=Optimix
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (Required for payments)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### Optional Environment Variables

```env
# Monitoring
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Analytics
NEXT_PUBLIC_GA_TRACKING_ID=your_ga_id

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# Email
RESEND_API_KEY=your_resend_key
FROM_EMAIL=noreply@optimix.com
```

See [`ENV_TEMPLATE.md`](./ENV_TEMPLATE.md) for detailed instructions.

---

## 📦 Project Structure

```
optimix/
├── app/                      # Next.js app directory
│   ├── (app)/               # App routes (protected)
│   ├── (auth)/              # Auth routes (public)
│   ├── api/                 # API routes
│   │   ├── payment/         # Payment endpoints
│   │   ├── bookings/        # Booking endpoints
│   │   ├── webhooks/        # Webhook handlers
│   │   └── health/          # Health check
│   ├── layout.tsx           # Root layout
│   ├── providers.tsx        # App providers
│   └── globals.css          # Global styles
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # UI components (Radix)
│   │   ├── gamification/   # Gamification components
│   │   └── vendor/         # Vendor-specific components
│   ├── views/              # Page components
│   ├── lib/                # Utilities and helpers
│   │   ├── api.ts          # API functions
│   │   ├── types.ts        # TypeScript types
│   │   ├── utils.ts        # Utility functions
│   │   └── validators.ts   # Zod schemas
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts
│   └── integrations/       # Third-party integrations
│       └── supabase/       # Supabase client & types
├── supabase/
│   ├── migrations/         # Database migrations
│   └── functions/          # Edge functions
├── prisma/
│   └── schema.prisma       # Prisma schema
├── scripts/                # Utility scripts
└── public/                 # Static assets
```

---

## 🚀 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:push      # Push schema changes

# Testing
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:e2e         # Run E2E tests
```

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**:
   ```bash
   npm run dev
   npm run test
   npm run lint
   ```

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

4. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

---

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests (requires running server)
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Test Stripe Payments

Use Stripe test cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0027 6000 3184

Any future expiry and any 3-digit CVC.

### Test Webhooks Locally

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
```

---

## 📚 Documentation

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[User Guide](./USER_GUIDE.md)** - End-user documentation
- **[Admin Guide](./ADMIN_GUIDE.md)** - Administrator manual
- **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Production deployment guide
- **[Environment Setup](./ENV_TEMPLATE.md)** - Environment variables guide
- **[Testing Guide](./TESTING_GUIDE.md)** - Testing documentation
- **[CodeRabbit Setup](./CODERABBIT_SETUP.md)** - CodeRabbit integration guide
- **[CodeRabbit Next Steps](./CODERABBIT_NEXT_STEPS.md)** - Complete setup instructions

---

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   # Development
   vercel

   # Production
   vercel --prod
   ```

4. **Configure Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables from `.env.local`

5. **Configure Stripe Webhook**:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Pre-Deployment Checklist

See [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) for complete checklist.

---

## 🔐 Security

- ✅ Authentication is managed by Clerk (hosted, 2FA ready)
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ API endpoints are rate-limited via Upstash Redis
- ✅ Input validation on all forms
- ✅ XSS protection via React
- ✅ CSRF protection
- ✅ Secure headers configured
- ✅ 2FA available for users

### Reporting Security Issues

Please report security vulnerabilities to security@optimix.com.

**Do not** create public GitHub issues for security problems.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

### Development Guidelines

1. Follow existing code style
2. Write tests for new features
3. Update documentation
4. Create meaningful commit messages
5. Keep PRs focused and small

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Stripe](https://stripe.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [React Query](https://tanstack.com/query)

Development Tools:
- [CodeRabbit](https://coderabbit.ai) - AI-powered code reviews

---

## 📞 Support

- **Documentation**: [https://docs.optimix.com](https://docs.optimix.com)
- **Email**: support@optimix.com
- **Discord**: [Join our community](https://discord.gg/optimix)
- **Issues**: [GitHub Issues](https://github.com/your-org/optimix/issues)

---

## 📊 Project Status

- ✅ Core features complete
- ✅ Payment integration complete
- ✅ Bookings system complete
- ✅ Admin dashboard complete
- ✅ Documentation complete
- 🚧 Mobile app (coming soon)
- 🚧 Advanced analytics (coming soon)

---

**Made with ❤️ by the Optimix Team**

**Version**: 1.0.0  
**Last Updated**: January 2024
