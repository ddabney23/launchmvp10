# 🧪 Testing Guide - Optimix

Comprehensive testing documentation for the Optimix platform.

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Running Tests](#running-tests)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [E2E Tests](#e2e-tests)
6. [Test Coverage](#test-coverage)
7. [Testing Best Practices](#testing-best-practices)

---

## Testing Strategy

We employ a comprehensive testing strategy:

- **Unit Tests**: Individual functions and components
- **Integration Tests**: Feature workflows and API interactions
- **E2E Tests**: Full user journeys
- **Manual Testing**: UI/UX and edge cases

### Test Pyramid

```
       /\
      /E2E\      ← Few (critical paths only)
     /------\
    /Integration\ ← Some (key workflows)
   /------------\
  /  Unit Tests  \ ← Many (all logic)
 /________________\
```

---

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Set up test environment
cp .env.local.example .env.test
```

### Test Commands

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui

# Run specific test file
npm run test -- src/__tests__/lib/api.test.ts

# Run tests matching pattern
npm run test -- --testNamePattern="payment"
```

---

## Unit Tests

### Writing Unit Tests

```typescript
// src/__tests__/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatPrice, calculateDiscount } from '@/lib/utils'

describe('formatPrice', () => {
  it('formats price correctly', () => {
    expect(formatPrice(99.99)).toBe('$99.99')
    expect(formatPrice(1000)).toBe('$1,000.00')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })

  it('rounds to 2 decimals', () => {
    expect(formatPrice(99.999)).toBe('$100.00')
  })
})

describe('calculateDiscount', () => {
  it('calculates percentage discount', () => {
    expect(calculateDiscount(100, 20)).toBe(80)
  })

  it('handles 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0)
  })

  it('throws on invalid percentage', () => {
    expect(() => calculateDiscount(100, 150)).toThrow()
  })
})
```

### Testing React Components

```typescript
// src/__tests__/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByText('Click me')).toBeDisabled()
  })
})
```

### Testing API Functions

```typescript
// src/__tests__/lib/api.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getProfile, updateProfile } from '@/lib/api'

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: createClient('http://localhost:54321', 'test-key'),
}))

describe('API - Profile', () => {
  const testUserId = 'test-user-id'

  it('gets profile by ID', async () => {
    const profile = await getProfile(testUserId)
    
    expect(profile).toBeDefined()
    expect(profile.id).toBe(testUserId)
  })

  it('updates profile successfully', async () => {
    await updateProfile(testUserId, {
      display_name: 'New Name',
    })

    const profile = await getProfile(testUserId)
    expect(profile.display_name).toBe('New Name')
  })

  it('throws error for non-existent user', async () => {
    await expect(getProfile('fake-id')).rejects.toThrow()
  })
})
```

---

## Integration Tests

### Testing User Workflows

```typescript
// src/__tests__/integration/checkout-flow.test.ts
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

describe('Checkout Flow', () => {
  it('completes full purchase', async () => {
    const user = userEvent.setup()
    
    // 1. Add item to cart
    render(<ProductPage productId="test-product" />)
    await user.click(screen.getByText('Add to Cart'))
    
    // 2. View cart
    await user.click(screen.getByText('Cart'))
    expect(screen.getByText('test-product')).toBeInTheDocument()
    
    // 3. Proceed to checkout
    await user.click(screen.getByText('Checkout'))
    
    // 4. Fill shipping info
    await user.type(screen.getByLabelText('Address'), '123 Main St')
    await user.type(screen.getByLabelText('City'), 'New York')
    await user.type(screen.getByLabelText('Zip'), '10001')
    
    // 5. Enter payment details
    await user.type(screen.getByLabelText('Card Number'), '4242424242424242')
    await user.type(screen.getByLabelText('Expiry'), '12/25')
    await user.type(screen.getByLabelText('CVC'), '123')
    
    // 6. Submit order
    await user.click(screen.getByText('Place Order'))
    
    // 7. Verify success
    await waitFor(() => {
      expect(screen.getByText('Order Confirmed')).toBeInTheDocument()
    })
  })
})
```

---

## E2E Tests

### Setting Up Playwright

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Run tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium
```

### Writing E2E Tests

```typescript
// tests/e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('user can sign up', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Go to sign up
    await page.click('text=Sign Up')
    
    // Fill form
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'Password123!')
    await page.click('button:has-text("Create Account")')
    
    // Should redirect to onboarding
    await expect(page).toHaveURL('/onboarding')
    
    // Complete onboarding
    await page.fill('[name="username"]', 'testuser')
    await page.fill('[name="display_name"]', 'Test User')
    await page.click('button:has-text("Continue")')
    
    // Should arrive at home
    await expect(page).toHaveURL('/home')
  })

  test('user can log in', async ({ page }) => {
    await page.goto('http://localhost:3000/auth')
    
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'Password123!')
    await page.click('button:has-text("Sign In")')
    
    await expect(page).toHaveURL('/home')
  })
})
```

### Critical Test Scenarios

1. **Authentication**
   - Sign up
   - Email verification
   - Login
   - Logout
   - Password reset
   - 2FA setup and verification

2. **Shopping**
   - Browse products
   - Add to cart
   - Update cart quantities
   - Remove from cart
   - Checkout flow
   - Payment processing

3. **Bookings**
   - View available dates
   - Create booking
   - Receive confirmation
   - Cancel booking

4. **Social**
   - Create post
   - Like/unlike
   - Comment
   - Follow/unfollow
   - Send message

5. **Vendor**
   - Create listing
   - Update listing
   - Manage orders
   - View analytics

---

## Test Coverage

### Coverage Requirements

- **Critical paths**: ≥ 90%
- **API routes**: ≥ 85%
- **Components**: ≥ 75%
- **Utilities**: ≥ 90%

### Generate Coverage Report

```bash
npm run test:coverage
```

View report:
```bash
open coverage/index.html
```

### Coverage Badges

Add to README:

```markdown
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
```

---

## Testing Best Practices

### General Principles

✅ **DO**:
- Write tests before fixing bugs (TDD)
- Test behavior, not implementation
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test edge cases and error paths
- Keep tests isolated and independent
- Use data-testid for stable selectors

❌ **DON'T**:
- Test implementation details
- Create brittle tests (tied to structure)
- Mock everything (integration tests need real code)
- Write tests just for coverage
- Skip error cases
- Use sleep/wait without conditions

### AAA Pattern

```typescript
it('calculates total price correctly', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ]

  // Act
  const total = calculateTotal(items)

  // Assert
  expect(total).toBe(35)
})
```

### Test Naming

```typescript
// ✅ Good
describe('formatPrice', () => {
  it('formats USD currency correctly', () => {})
  it('handles negative values', () => {})
  it('throws error for invalid input', () => {})
})

// ❌ Bad
describe('formatPrice', () => {
  it('test 1', () => {})
  it('works', () => {})
  it('formatPrice should format price', () => {})
})
```

### Mocking

```typescript
// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [] })),
      insert: vi.fn(() => Promise.resolve({ data: {} })),
    })),
  },
}))

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/test',
}))
```

### Testing Async Code

```typescript
// ✅ Use async/await
it('loads data successfully', async () => {
  const data = await fetchData()
  expect(data).toBeDefined()
})

// ✅ Use waitFor for delayed updates
it('shows success message', async () => {
  render(<Component />)
  
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
})

// ❌ Don't use arbitrary timeouts
it('shows success message', async () => {
  render(<Component />)
  await new Promise(r => setTimeout(r, 1000)) // Don't do this!
  expect(screen.getByText('Success')).toBeInTheDocument()
})
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Troubleshooting

### Common Issues

**Tests hang forever:**
- Check for missing `await` on async operations
- Ensure all timers are mocked or cleared

**Flaky tests:**
- Use `waitFor` instead of fixed timeouts
- Ensure proper cleanup between tests
- Check for race conditions

**Import errors:**
- Verify path aliases in `tsconfig.json`
- Check vitest.config.ts configuration

**Database tests fail:**
- Ensure test database is seeded
- Use transactions to isolate tests
- Reset database between test suites

---

**Testing Tools:**
- **Vitest**: Unit tests
- **Playwright**: E2E tests
- **Testing Library**: React component tests
- **MSW**: API mocking

**Version**: 1.0.0  
**Last Updated**: January 2024

