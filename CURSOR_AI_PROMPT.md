# Cursor AI Development Prompt

## Project Context
This is a **full-stack Next.js 15 social marketplace application** with the following technology stack:

### Core Technologies
- **Framework**: Next.js 15.1.4 (App Router, React Server Components, Server Actions)
- **Language**: TypeScript 5.7.2 (strict mode enabled)
- **Styling**: Tailwind CSS 3.4.1 + shadcn/ui components
- **Database**: Supabase (PostgreSQL) with Row-Level Security (RLS)
- **Authentication**: Clerk (JWT-based with Supabase integration)
- **Payments**: Stripe
- **Caching**: Upstash Redis (rate limiting, performance optimization)
- **Testing**: Vitest 3.2.4 + Testing Library + Playwright (E2E)

### Application Features
- **Social Network**: Posts, comments, likes, follows, profiles
- **Marketplace**: Product listings, vendor verification, shopping cart, bookings
- **Gamification**: Badges, points, achievements, leaderboards
- **Real-time**: Live notifications, activity feeds
- **Admin**: User management, content moderation, vendor approval, analytics

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth-related pages (sign-in, sign-up)
│   ├── (main)/            # Main app pages (protected routes)
│   ├── admin/             # Admin dashboard pages
│   └── api/               # API routes (Next.js route handlers)
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Feature components
├── lib/                   # Core utilities
│   ├── api.ts            # Client-side API functions
│   ├── validators.ts     # Zod schemas for data validation
│   ├── sanitize.ts       # Input sanitization (XSS prevention)
│   ├── supabase-helpers.ts # Supabase utilities
│   └── validations/      # Shared validation schemas
├── integrations/
│   └── supabase/         # Supabase client & types
├── hooks/                # Custom React hooks
├── contexts/             # React Context providers
├── views/                # Page-level view components
├── middleware.ts         # Next.js middleware (Clerk auth)
└── test/                 # Test utilities and setup

tests/
├── unit/                 # Unit tests
├── integration/          # Integration tests
└── e2e/                  # Playwright E2E tests
```

## Development Guidelines

### 1. Code Quality Standards
- **TypeScript**: Use strict mode, avoid `any`, prefer interfaces over types for objects
- **Error Handling**: Use custom `ApiError` class for API errors, include error codes and HTTP status
- **Validation**: All API inputs must be validated with Zod schemas before processing
- **Sanitization**: Always sanitize user inputs using `sanitizeString()` or `sanitizeHtml()` from `lib/sanitize.ts`
- **Testing**: Maintain 95%+ test coverage, write unit tests for all new functions
- **Accessibility**: Use semantic HTML, ARIA labels, keyboard navigation support

### 2. Authentication & Authorization
- **Client-side**: Use `useUser()` hook from Clerk for auth state
- **Server-side**: Use `auth()` from `@clerk/nextjs/server` in Server Components/Actions
- **API Routes**: Verify JWT tokens via Supabase `auth.getUser()` or `auth.getSession()`
- **RLS Policies**: All database queries automatically filtered by Supabase RLS policies
- **User IDs**: Always use Clerk user ID for auth, sync with Supabase profiles table

### 3. Database Operations (Supabase)
- **Queries**: Use Supabase client from `@/integrations/supabase/client`
- **Type Safety**: Import database types from `@/integrations/supabase/types`
- **Error Handling**: Always check for `error` in Supabase responses
- **RLS**: Ensure all tables have proper RLS policies enabled
- **Indexes**: Add indexes for frequently queried columns (user_id, created_at, etc.)

### 4. API Development
- **Route Handlers**: Located in `app/api/[feature]/route.ts`
- **Response Format**: Use helpers from `lib/api-response.ts` (successResponse, errorResponse, etc.)
- **Rate Limiting**: Apply rate limiting via `checkRateLimit()` from `lib/rate-limit.ts`
- **Validation**: Use `validateRequest()` helper to validate request bodies
- **CORS**: Configure in route handlers if needed for external API access

### 5. Component Patterns
- **Server Components**: Default for pages, use for data fetching
- **Client Components**: Add `"use client"` only when needed (hooks, events, browser APIs)
- **shadcn/ui**: Use existing components from `components/ui/`, install new ones via CLI
- **Forms**: Use React Hook Form + Zod validation
- **Loading States**: Use `<Skeleton>` components or loading.tsx files
- **Error Boundaries**: Implement error.tsx for error handling

### 6. Performance Optimization
- **Caching**: Use Redis for frequently accessed data (leaderboards, stats)
- **Database**: Implement pagination, use select() to limit columns returned
- **Images**: Use Next.js `<Image>` component with proper sizing
- **Code Splitting**: Dynamic imports for heavy components
- **API**: Batch requests when possible, avoid N+1 queries

### 7. Testing Strategy
- **Unit Tests**: All functions in `lib/`, `hooks/`, utilities
- **Integration Tests**: API routes, database operations
- **E2E Tests**: Critical user flows (auth, checkout, posting)
- **Mocking**: Use Vitest mocks, avoid real API calls in tests
- **Coverage**: Run `npm run test:coverage` to check coverage

## Common Commands
```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run start            # Start production server

# Testing
npm run test             # Run all Vitest tests
npm run test:watch       # Watch mode
npm run test:ui          # Vitest UI
npm run test:e2e         # Playwright E2E tests
npm run test:coverage    # Coverage report

# Database
npx supabase db reset    # Reset local database
npx supabase migration new <name>  # Create new migration
npx supabase db push     # Push migrations to remote

# Code Quality
npm run lint             # ESLint check
npm run type-check       # TypeScript check
```

## Key Files to Reference

### Configuration
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `.env.local` - Environment variables (create from `.env.example.txt`)

### Core Libraries
- `src/lib/api.ts` - Client-side API functions (getProfile, createPost, like, etc.)
- `src/lib/validators.ts` - Zod schemas for all data models
- `src/lib/api-response.ts` - API response helpers
- `src/lib/supabase-helpers.ts` - Database utilities
- `src/lib/rate-limit.ts` - Rate limiting implementation

### Authentication
- `src/middleware.ts` - Clerk middleware configuration
- `src/hooks/useAuth.ts` - Auth hook for client components
- `src/app/api/webhooks/clerk/route.ts` - Clerk webhook handler

### Documentation
- `DOCUMENTATION_INDEX.md` - Comprehensive system documentation
- `API_DOCUMENTATION.md` - API routes reference
- `DEPLOYMENT_CHECKLIST.md` - Production deployment guide
- `TESTING_GUIDE.md` - Testing best practices

## Current State (as of Nov 2024)

### ✅ Completed Features
- Full authentication system with Clerk
- User profiles with follow/unfollow
- Post creation, editing, deletion with media support
- Comment system with threading
- Like system (posts, comments, listings)
- Vendor verification workflow
- Shopping cart with Stripe checkout
- Booking system for services
- Gamification (badges, points, levels)
- Admin dashboard with analytics
- Rate limiting and security measures
- Comprehensive test suite (201/205 passing - 98%)

### 🚧 Known Issues
- 4 integration test failures (require running dev server)
- Some responsive design edge cases need polish
- Performance monitoring integration partially complete

### 📋 TODO / Enhancement Ideas
- [ ] Real-time notifications via WebSockets
- [ ] Advanced search with Elasticsearch
- [ ] Content recommendation algorithm
- [ ] Mobile app (React Native)
- [ ] Internationalization (i18n)
- [ ] Advanced analytics dashboard
- [ ] Email notifications system
- [ ] File upload optimization

## When Working on This Project

### Always:
1. **Validate Inputs**: Use Zod schemas, sanitize user data
2. **Handle Errors**: Try-catch blocks, proper error messages
3. **Check Auth**: Verify user authentication before sensitive operations
4. **Type Everything**: No `any` types, leverage TypeScript
5. **Test Changes**: Write tests, run test suite before committing
6. **Document**: Add JSDoc comments for public functions

### Never:
1. **Expose Secrets**: Keep API keys in .env.local, never commit
2. **Skip Validation**: Always validate API inputs
3. **Use Inline Styles**: Use Tailwind classes or CSS modules
4. **Ignore Errors**: Always handle Supabase errors and edge cases
5. **Hardcode URLs**: Use environment variables for endpoints
6. **Commit node_modules**: Already in .gitignore

## Debugging Tips

### Common Issues
1. **"Not authenticated"**: Check Clerk session, verify middleware config
2. **Database query fails**: Check RLS policies, verify user permissions
3. **Type errors**: Run `npm run type-check`, check imports
4. **Tests failing**: Check mocks in `src/test/setup.ts`, verify test data
5. **Build errors**: Clear `.next` folder, reinstall dependencies

### Useful Debug Commands
```bash
# Check database connection
npx supabase status

# Inspect JWT token
# Go to https://jwt.io and paste token from browser dev tools

# View RLS policies
# Check Supabase dashboard → Authentication → Policies

# Reset test database
npm run test -- --run

# Check bundle size
npm run build -- --analyze
```

## AI Assistant Instructions

When I ask you to:

### Add a Feature
1. Understand the feature requirements fully
2. Check existing similar implementations
3. Create/update database schema if needed (migrations)
4. Implement API route with validation and error handling
5. Create client-side API function in `lib/api.ts`
6. Build UI components (Server Component → Client Component as needed)
7. Add proper TypeScript types
8. Write unit and integration tests
9. Update documentation

### Fix a Bug
1. Reproduce the issue locally
2. Check error logs and stack traces
3. Identify root cause (authentication, validation, database, etc.)
4. Implement fix with proper error handling
5. Add regression test to prevent recurrence
6. Verify fix doesn't break existing functionality

### Refactor Code
1. Identify code smells and improvement opportunities
2. Plan refactoring (extract functions, improve naming, etc.)
3. Make incremental changes with tests passing
4. Ensure backward compatibility where needed
5. Update related documentation

### Write Tests
1. Identify what needs testing (function, API, flow)
2. Write descriptive test cases
3. Mock external dependencies (Supabase, Clerk, Stripe)
4. Test happy path and error cases
5. Aim for 95%+ coverage for new code
6. Run full test suite to verify no regressions

### Review Code
1. Check TypeScript types (no `any`)
2. Verify input validation and sanitization
3. Ensure error handling is comprehensive
4. Check for security vulnerabilities (XSS, SQL injection, etc.)
5. Verify tests are included and passing
6. Suggest performance improvements if applicable

## Example Workflows

### Adding a New API Endpoint
```typescript
// 1. Create route handler: app/api/my-feature/route.ts
import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { supabase } from '@/integrations/supabase/client'
import { MySchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return errorResponse('Unauthorized', 401)

    // Validate input
    const body = await request.json()
    const validatedData = MySchema.parse(body)

    // Database operation
    const { data, error } = await supabase
      .from('my_table')
      .insert(validatedData)
      .select()
      .single()

    if (error) throw error

    return successResponse(data)
  } catch (error) {
    return errorResponse(error.message, 500)
  }
}

// 2. Add client function: lib/api.ts
export async function myApiFunction(input: MyInput): Promise<MyOutput> {
  const response = await fetch('/api/my-feature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  
  if (!response.ok) throw new ApiError(await response.text())
  return response.json()
}

// 3. Add test: lib/__tests__/api.test.ts
describe('myApiFunction', () => {
  it('should create resource successfully', async () => {
    // Mock setup
    // Call function
    // Assert result
  })
})
```

## Project Philosophy
- **Type Safety**: Catch errors at compile time, not runtime
- **Security First**: Validate everything, sanitize inputs, use RLS
- **User Experience**: Fast, responsive, accessible, intuitive
- **Developer Experience**: Clear code, good documentation, helpful errors
- **Maintainability**: Consistent patterns, modular code, comprehensive tests

---

**This prompt should be used as context for all future development on this project. It ensures consistency, quality, and adherence to best practices.**

Last Updated: December 2024  
Test Coverage: **205/205 (100%)** ✅  
Status: Production-ready - All tests passing
