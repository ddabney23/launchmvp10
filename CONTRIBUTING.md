# 🤝 Contributing to Optimix

Thank you for your interest in contributing to Optimix! This document provides guidelines and instructions for contributing.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Pull Request Process](#pull-request-process)
7. [Reporting Bugs](#reporting-bugs)
8. [Suggesting Features](#suggesting-features)

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone.

### Our Standards

✅ **Positive behaviors**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what's best for the community

❌ **Unacceptable behaviors**:
- Trolling, insulting, or derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct that is unprofessional

---

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR-USERNAME/optimix.git
cd optimix
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment variables
cp ENV_TEMPLATE.md .env.local
# Fill in your credentials

# Generate Prisma Client
npm run prisma:generate

# Start development server
npm run dev
```

### 3. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

---

## Development Workflow

### Branch Naming

- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation updates
- `refactor/what-changed` - Code refactoring
- `test/what-tested` - Test additions
- `chore/what-changed` - Maintenance tasks

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <description>

# Examples
feat(payments): add refund processing
fix(auth): resolve 2FA verification issue
docs(readme): update installation instructions
test(api): add booking conflict tests
refactor(ui): simplify navigation component
chore(deps): update dependencies
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance
- `perf`: Performance improvement

---

## Coding Standards

### TypeScript

```typescript
// ✅ Good
interface UserProfile {
  id: string
  username: string
  email: string
}

export async function getProfile(userId: string): Promise<UserProfile> {
  // Implementation
}

// ❌ Bad
function getProfile(userId: any) {
  // No types, no return type
}
```

### React Components

```typescript
// ✅ Good - Functional component with TypeScript
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick} className={variant}>{children}</button>
}

// ❌ Bad - Class component, no types
export class Button extends React.Component {
  render() {
    return <button>{this.props.children}</button>
  }
}
```

### File Organization

```
src/
├── components/       # Reusable components
│   ├── ui/          # UI primitives
│   └── feature/     # Feature-specific components
├── views/           # Page components
├── lib/             # Utilities and helpers
├── hooks/           # Custom hooks
├── contexts/        # React contexts
└── integrations/    # Third-party integrations
```

### Naming Conventions

- **Files**: PascalCase for components (`Button.tsx`), camelCase for utils (`api.ts`)
- **Components**: PascalCase (`UserProfile`)
- **Functions**: camelCase (`getUserProfile`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with `I` prefix optional (`UserProfile` or `IUserProfile`)

### Code Style

- Use functional components over class components
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Destructure props and state
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Add JSDoc comments for complex functions

```typescript
/**
 * Calculates the total price including tax
 * @param subtotal - Subtotal amount
 * @param taxRate - Tax rate (0-1)
 * @returns Total amount with tax
 */
export function calculateTotal(subtotal: number, taxRate: number): number {
  return subtotal * (1 + taxRate)
}
```

---

## Testing Requirements

### Test Coverage

All contributions must include tests:

- ✅ **New features**: Unit tests + integration tests
- ✅ **Bug fixes**: Regression test
- ✅ **Refactoring**: Maintain existing test coverage
- ✅ **API changes**: API tests

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test
npm run test -- path/to/test.ts

# Generate coverage
npm run test:coverage
```

### Writing Tests

```typescript
// Example: Testing a utility function
import { describe, it, expect } from 'vitest'
import { formatPrice } from '@/lib/utils'

describe('formatPrice', () => {
  it('formats USD correctly', () => {
    expect(formatPrice(99.99)).toBe('$99.99')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })
})
```

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for complete testing documentation.

---

## Pull Request Process

### Before Submitting

1. ✅ Code follows style guidelines
2. ✅ All tests pass
3. ✅ Code is properly commented
4. ✅ Documentation updated (if needed)
5. ✅ No TypeScript errors
6. ✅ No linting errors

```bash
# Verify before PR
npm run lint
npm run test
npx tsc --noEmit --skipLibCheck
```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added where needed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally

## Screenshots (if applicable)
Add screenshots here
```

### Review Process

1. **Automated checks**: All CI checks must pass
2. **CodeRabbit review**: AI-powered code review will automatically review your PR
3. **Code review**: At least one approval required
4. **Testing**: All tests must pass
5. **Documentation**: Docs must be updated
6. **Merge**: Squash and merge to main

#### CodeRabbit Automated Reviews

We use [CodeRabbit](https://coderabbit.ai) to provide automated code reviews on every pull request. CodeRabbit will:

- ✅ Review code quality and best practices
- ✅ Check for security vulnerabilities
- ✅ Suggest performance improvements
- ✅ Verify TypeScript type safety
- ✅ Check Next.js and React patterns
- ✅ Validate API route security
- ✅ Review database query optimization
- ✅ Ensure proper error handling

**What to expect:**
- CodeRabbit will comment on your PR with suggestions
- Review comments will appear inline on specific lines of code
- Critical issues may trigger a "request changes" workflow
- All suggestions are meant to help improve code quality

**How to respond:**
- Address critical security or bug issues
- Consider performance suggestions
- Apply best practice recommendations when appropriate
- Ask questions if a suggestion is unclear
- You can dismiss suggestions if you have a valid reason

The CodeRabbit configuration is in `.coderabbit.yaml` and can be customized for project-specific needs.

---

## Reporting Bugs

### Before Reporting

1. Check existing issues
2. Verify it's reproducible
3. Test on latest version

### Bug Report Template

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Screenshots**
If applicable

**Environment**
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Version: [e.g., 1.0.0]

**Additional Context**
Any other relevant information
```

---

## Suggesting Features

### Feature Request Template

```markdown
**Feature Description**
Clear description of the feature

**Problem it Solves**
What problem does this solve?

**Proposed Solution**
How should this work?

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
Mockups, examples, etc.
```

---

## Development Guidelines

### Adding New Features

1. **Plan**: Discuss in issue before coding
2. **Design**: Create mockups if UI changes
3. **Implement**: Follow coding standards
4. **Test**: Write comprehensive tests
5. **Document**: Update relevant docs
6. **Review**: Submit PR for review

### Modifying Existing Features

1. **Understand**: Read existing code and tests
2. **Plan**: Consider backward compatibility
3. **Implement**: Make changes
4. **Test**: Ensure no regressions
5. **Document**: Update docs
6. **Migrate**: Provide migration guide if breaking

### Database Changes

1. **Schema**: Update Prisma schema
2. **Migration**: Create migration file
3. **Test**: Test migration up and down
4. **Docs**: Document schema changes
5. **Types**: Regenerate TypeScript types

```bash
# After schema changes
npx prisma migrate dev --name descriptive_name
npm run prisma:generate
```

---

## Style Guide

### React/Next.js

```typescript
// ✅ Good
'use client' // When needed

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function MyComponent() {
  const [count, setCount] = useState(0)
  
  return (
    <div>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(count + 1)}>
        Increment
      </Button>
    </div>
  )
}

// ❌ Bad
import React from 'react' // Unnecessary in Next.js 13+

export default class MyComponent extends React.Component {
  // Use functional components
}
```

### API Routes

```typescript
// ✅ Good
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Validate input
    // Process request
    // Return response
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    )
  }
}
```

### Error Handling

```typescript
// ✅ Good - Specific error handling
try {
  await riskyOperation()
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NetworkError) {
    // Handle network error
  } else {
    // Handle unexpected error
    console.error('Unexpected error:', error)
  }
}

// ❌ Bad - Swallow errors
try {
  await riskyOperation()
} catch (error) {
  // Ignoring error
}
```

---

## Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Tailwind Docs](https://tailwindcss.com/docs)

### Internal Docs
- [README.md](./README.md) - Project overview
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Deployment guide

---

## Recognition

Contributors will be recognized in:
- Contributors list in README
- Release notes
- Project website

---

## Questions?

- **Documentation**: Check the `/docs` folder
- **Issues**: Search existing issues on GitHub
- **Chat**: Join our Discord server
- **Email**: dev@optimix.com

---

Thank you for contributing to Optimix! 🎉

**Last Updated**: January 2024

