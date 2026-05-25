# Testing Guide for Optimix

## Overview

This directory contains all tests for the Optimix platform.

---

## Test Structure

```
tests/
├── unit/               # Unit tests
│   ├── api.test.ts    # API function tests
│   └── utils.test.ts  # Utility function tests
├── integration/       # Integration tests
│   └── api-routes.test.ts  # API route tests
└── e2e/              # End-to-end tests
    ├── auth.spec.ts   # Authentication flow
    ├── checkout.spec.ts  # Checkout flow
    └── social.spec.ts    # Social features
```

---

## Running Tests

### Unit Tests (Vitest)
```bash
# Run all unit tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# UI mode
npm run test:ui
```

### E2E Tests (Playwright)
```bash
# Run all E2E tests
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/e2e/checkout.spec.ts
```

---

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/lib/utils'

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input')
    expect(result).toBe('expected output')
  })
})
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test'

test('should complete user flow', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.click('button:has-text("Sign In")')
  await expect(page).toHaveURL(/.*auth/)
})
```

---

## Test Coverage

### Current Coverage

Run `npm run test:coverage` to see detailed coverage report.

### Coverage Goals
- **Functions**: > 80%
- **Branches**: > 75%
- **Lines**: > 80%
- **Statements**: > 80%

---

## Testing Best Practices

1. **Write tests before fixing bugs** (TDD)
2. **Test user flows, not implementation details**
3. **Use descriptive test names**
4. **Keep tests independent**
5. **Mock external dependencies**
6. **Test edge cases and error scenarios**

---

## CI/CD Integration

### GitHub Actions (recommended)

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run test:e2e
```

---

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Module not found"
**Solution**: Run `npm install` and ensure all dependencies are installed

**Issue**: E2E tests timeout
**Solution**: Increase timeout in `playwright.config.ts` or ensure dev server is running

**Issue**: Database errors in tests
**Solution**: Use test database or mock Supabase client

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

