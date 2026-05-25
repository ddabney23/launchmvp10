# 🤖 CodeRabbit Integration Guide

This document explains how CodeRabbit is integrated into the Optimix project and how to use it effectively.

## What is CodeRabbit?

CodeRabbit is an AI-powered code review tool that automatically reviews pull requests on GitHub. It provides:

- 🔒 **Security Analysis**: Detects vulnerabilities and security issues
- ⚡ **Performance Suggestions**: Identifies performance bottlenecks
- 📝 **Code Quality**: Reviews best practices and code patterns
- 🎯 **Framework-Specific**: Tailored reviews for Next.js, TypeScript, React
- 🔍 **Type Safety**: Validates TypeScript usage
- 🛡️ **Best Practices**: Ensures adherence to project standards

## Setup Instructions

### 1. Install CodeRabbit GitHub App

1. Go to [CodeRabbit.ai](https://coderabbit.ai)
2. Sign in with your GitHub account
3. Click "Install GitHub App"
4. Select your repository (`my-app-master` or your GitHub repo name)
5. Grant necessary permissions:
   - Read access to code
   - Write access to pull requests
   - Read access to checks

### 2. Configuration Files

The project includes the following CodeRabbit configuration:

- **`.coderabbit.yaml`**: Main configuration file with review rules and settings
- **`.github/workflows/coderabbit.yml`**: GitHub Actions workflow for automated reviews (optional)

**Note**: CodeRabbit primarily works through the GitHub App. Once installed, it will automatically review PRs. The workflow file provides additional automation but is not strictly required.

### 3. Verify Installation

After installing the GitHub App:

1. Create a test pull request
2. CodeRabbit should automatically start reviewing
3. Check the PR comments for CodeRabbit's review

## How It Works

### Automatic Reviews

CodeRabbit automatically reviews pull requests when:

- A new PR is opened
- New commits are pushed to an existing PR
- A PR is reopened
- A PR is marked as "ready for review"

### Review Focus Areas

Based on our `.coderabbit.yaml` configuration, CodeRabbit focuses on:

#### Security
- ✅ Clerk authentication patterns
- ✅ RLS (Row Level Security) policy verification
- ✅ API endpoint security
- ✅ Input validation with Zod
- ✅ Webhook signature validation
- ✅ SQL injection prevention
- ✅ Environment variable security

#### Code Quality
- ✅ TypeScript strict mode compliance
- ✅ Next.js App Router best practices
- ✅ React Server Components vs Client Components
- ✅ Proper error handling
- ✅ Code organization and structure

#### Performance
- ✅ Database query optimization
- ✅ React component optimization
- ✅ Bundle size checks
- ✅ Image optimization
- ✅ Code splitting

#### Best Practices
- ✅ API route patterns
- ✅ Form handling with React Hook Form
- ✅ State management with React Query
- ✅ Prisma query patterns
- ✅ Migration best practices

## Review Process

### What Happens During Review

1. **Code Analysis**: CodeRabbit analyzes your changes
2. **Rule Checking**: Applies project-specific rules from `.coderabbit.yaml`
3. **Comment Generation**: Creates inline comments on specific lines
4. **Summary**: Provides an overall review summary
5. **Action Items**: May request changes for critical issues

### Review Comments

CodeRabbit will comment on:

- **Security Issues**: Critical vulnerabilities that must be fixed
- **Performance**: Suggestions for optimization
- **Best Practices**: Recommendations for better code patterns
- **Type Safety**: TypeScript-related suggestions
- **Code Quality**: General code improvement suggestions

### Review Threshold

The review threshold is set to **70%** (configurable in `.coderabbit.yaml`). This means:

- CodeRabbit will provide comprehensive reviews
- Critical issues will be flagged
- Suggestions are provided but not all are mandatory

## Responding to Reviews

### Critical Issues (Must Fix)

These are security vulnerabilities or bugs that should be addressed:

```typescript
// Example: Security issue flagged by CodeRabbit
// ❌ Bad - No authentication check
export async function GET(req: NextRequest) {
  const data = await getSensitiveData()
  return NextResponse.json(data)
}

// ✅ Good - Fixed with authentication
export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const data = await getSensitiveData(userId)
  return NextResponse.json(data)
}
```

### Suggestions (Consider)

These are recommendations that improve code quality but aren't critical:

```typescript
// Example: Performance suggestion
// CodeRabbit might suggest:
// "Consider using useMemo to avoid recalculating this value on every render"

// You can:
// 1. Apply the suggestion if it makes sense
// 2. Dismiss it if you have a valid reason
// 3. Ask for clarification in a comment
```

### Best Practices (Optional)

These help maintain consistency and follow project standards:

- Code formatting
- Naming conventions
- File organization
- Documentation

## Customization

### Modifying Review Rules

Edit `.coderabbit.yaml` to customize:

```yaml
# Example: Adjust review threshold
review:
  review_threshold: 80  # More strict (0-100)

# Example: Focus on specific areas
focus:
  - "API security"
  - "Database optimization"

# Example: Exclude specific paths
paths:
  exclude:
    - "legacy/**"
    - "experimental/**"
```

### File-Specific Rules

You can add rules for specific file patterns:

```yaml
file_patterns:
  - pattern: "app/api/**/*.ts"
    focus:
      - "API route security"
      - "Error handling"
```

## Workflow Integration

### GitHub Actions

The `.github/workflows/coderabbit.yml` workflow:

- Runs on every PR
- Installs dependencies
- Triggers CodeRabbit review
- Posts review summary

### CI/CD Integration

CodeRabbit works alongside:

- ✅ ESLint (code quality)
- ✅ TypeScript compiler (type checking)
- ✅ Vitest/Jest (testing)
- ✅ Playwright (E2E testing)

It adds an additional layer of AI-powered review.

## Best Practices

### For Contributors

1. **Read Reviews Carefully**: CodeRabbit provides valuable insights
2. **Address Critical Issues**: Fix security and bug issues
3. **Consider Suggestions**: Evaluate performance and best practice suggestions
4. **Ask Questions**: If a suggestion is unclear, ask for clarification
5. **Learn from Reviews**: Use feedback to improve future code

### For Maintainers

1. **Review CodeRabbit Comments**: Ensure they align with project goals
2. **Adjust Configuration**: Update `.coderabbit.yaml` as needed
3. **Monitor Reviews**: Check that reviews are helpful and accurate
4. **Provide Feedback**: Help improve CodeRabbit's understanding of the project

## Troubleshooting

### CodeRabbit Not Reviewing PRs

1. **Check Installation**: Verify GitHub App is installed
2. **Check Permissions**: Ensure app has necessary permissions
3. **Check Workflow**: Verify `.github/workflows/coderabbit.yml` exists
4. **Check PR Status**: CodeRabbit only reviews non-draft PRs

### Too Many Comments

If CodeRabbit is too verbose:

1. Adjust `review_threshold` in `.coderabbit.yaml`
2. Exclude more paths in `paths.exclude`
3. Reduce `max_comments_per_file`

### Missing Reviews

If reviews aren't comprehensive enough:

1. Lower `review_threshold`
2. Add more focus areas
3. Include more file patterns

## Configuration Reference

### Key Settings in `.coderabbit.yaml`

```yaml
# Review types to enable
reviews:
  security: true
  performance: true
  best_practices: true
  code_quality: true

# Review threshold (0-100)
review:
  review_threshold: 70

# Paths to include/exclude
paths:
  include:
    - "app/**"
    - "src/**"
  exclude:
    - "node_modules/**"
    - ".next/**"

# Custom rules
rules:
  - "Check for proper authentication"
  - "Verify RLS policies"
```

## Resources

- **CodeRabbit Website**: [https://coderabbit.ai](https://coderabbit.ai)
- **Documentation**: [https://docs.coderabbit.ai](https://docs.coderabbit.ai)
- **Configuration File**: `.coderabbit.yaml` in project root
- **Workflow File**: `.github/workflows/coderabbit.yml`

## Support

If you have questions about CodeRabbit:

1. Check the [CodeRabbit Documentation](https://docs.coderabbit.ai)
2. Review `.coderabbit.yaml` for project-specific settings
3. Ask in project discussions or issues
4. Contact project maintainers

---

**Last Updated**: December 2024

