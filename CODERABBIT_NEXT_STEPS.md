# 🚀 CodeRabbit Next Steps - Setup Guide

Follow these steps to complete the CodeRabbit integration and start receiving automated code reviews.

## Step 1: Install CodeRabbit GitHub App

### Prerequisites
- Your project must be pushed to a GitHub repository
- You need admin access to the repository (or be the owner)

### Installation Steps

1. **Navigate to CodeRabbit**
   - Go to [https://coderabbit.ai](https://coderabbit.ai)
   - Click "Sign in with GitHub" or "Get Started"

2. **Install the GitHub App**
   - Click "Install GitHub App" or go to [GitHub Marketplace - CodeRabbit](https://github.com/marketplace/coderabbitai)
   - Click "Install it for free" or "Set up a plan"
   - Select your GitHub account (personal or organization)

3. **Select Repository**
   - Choose "Only select repositories"
   - Select your repository: `my-app-master` (or your actual repo name)
   - Click "Install"

4. **Grant Permissions**
   CodeRabbit needs these permissions:
   - ✅ **Read access** to code and pull requests
   - ✅ **Write access** to pull requests (for comments)
   - ✅ **Read access** to checks (for CI integration)

5. **Complete Installation**
   - Review and accept the permissions
   - You'll be redirected back to CodeRabbit dashboard

## Step 2: Verify Git Repository Setup

Before CodeRabbit can work, ensure your project is a Git repository:

```bash
# Check if git is initialized
git status

# If not initialized, initialize git
git init

# Add remote repository (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Verify remote
git remote -v
```

## Step 3: Commit CodeRabbit Configuration

The following files have been created for CodeRabbit:

- `.coderabbit.yaml` - Configuration file
- `.github/workflows/coderabbit.yml` - GitHub Actions workflow
- `CODERABBIT_SETUP.md` - Documentation

Commit these files:

```bash
# Add the new files
git add .coderabbit.yaml
git add .github/workflows/coderabbit.yml
git add CODERABBIT_SETUP.md
git add CODERABBIT_NEXT_STEPS.md
git add CONTRIBUTING.md  # Updated with CodeRabbit info
git add README.md  # Updated with CodeRabbit info

# Commit
git commit -m "feat: integrate CodeRabbit for automated code reviews"

# Push to GitHub
git push origin main
# or
git push origin master
```

## Step 4: Test CodeRabbit Integration

### Create a Test Pull Request

1. **Create a test branch:**
   ```bash
   git checkout -b test/coderabbit-integration
   ```

2. **Make a small change** (or use the test file below):
   ```bash
   # Create a test file
   echo "// Test file for CodeRabbit" > test-coderabbit.ts
   ```

3. **Commit and push:**
   ```bash
   git add test-coderabbit.ts
   git commit -m "test: add test file for CodeRabbit review"
   git push origin test/coderabbit-integration
   ```

4. **Create Pull Request:**
   - Go to your GitHub repository
   - Click "Compare & pull request"
   - Add a description: "Testing CodeRabbit integration"
   - Click "Create pull request"

5. **Wait for CodeRabbit Review:**
   - CodeRabbit will automatically start reviewing within a few minutes
   - Check the PR comments for CodeRabbit's feedback
   - You should see inline comments on specific lines

### Test File Example

Create a file with intentional issues to test CodeRabbit:

```typescript
// test-coderabbit.ts
// This file has intentional issues for CodeRabbit to catch

// ❌ Issue 1: No type annotation
export function addNumbers(a, b) {
  return a + b
}

// ❌ Issue 2: Using 'any' type
export function processData(data: any) {
  return data.value
}

// ❌ Issue 3: No error handling
export async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`)
  const user = await response.json()
  return user
}

// ❌ Issue 4: Exposing sensitive data
export const API_KEY = "sk_live_1234567890"

// ✅ Good example (for comparison)
export interface User {
  id: string
  name: string
  email: string
}

export async function getUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`)
    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching user:', error)
    throw error
  }
}
```

CodeRabbit should flag:
- Missing type annotations
- Use of `any` type
- Missing error handling
- Exposed API keys

## Step 5: Verify CodeRabbit is Working

### Check PR Comments

After creating a PR, you should see:

1. **CodeRabbit Bot Comments**
   - Look for comments from `coderabbit[bot]` or `coderabbitai`
   - Inline comments on specific code lines
   - Overall review summary

2. **GitHub Actions Workflow**
   - Go to the "Actions" tab in your repository
   - You should see "CodeRabbit Review" workflow running
   - Check that it completes successfully

3. **Review Summary**
   - CodeRabbit will provide a summary of:
     - Security issues found
     - Performance suggestions
     - Code quality improvements
     - Best practice recommendations

### Expected Behavior

✅ **Working correctly if:**
- CodeRabbit comments appear on your PR
- Inline suggestions are provided
- Review summary is posted
- GitHub Actions workflow runs successfully

❌ **Not working if:**
- No comments appear after 10-15 minutes
- GitHub Actions workflow fails
- Error messages in the Actions log

## Step 6: Customize Configuration (Optional)

### Adjust Review Settings

Edit `.coderabbit.yaml` to customize:

```yaml
# Make reviews more strict
review:
  review_threshold: 80  # Higher = more strict

# Review only changed files (faster)
review:
  review_only_changed_files: true

# Reduce comment volume
review:
  max_comments_per_file: 25
```

### Add Project-Specific Rules

Add custom instructions in `.coderabbit.yaml`:

```yaml
instructions:
  - "Always use Clerk for authentication"
  - "Verify RLS policies before database queries"
  - "Use Zod for all input validation"
```

## Step 7: Integrate into Development Workflow

### For Individual Developers

1. **Before Pushing:**
   ```bash
   # Run local checks
   npm run lint
   npm run test
   npx tsc --noEmit
   ```

2. **Create PR:**
   - Push your branch
   - Create pull request
   - Wait for CodeRabbit review

3. **Address Feedback:**
   - Review CodeRabbit's suggestions
   - Fix critical issues
   - Consider performance suggestions
   - Apply best practices

4. **Update PR:**
   - Make changes based on feedback
   - Push updates
   - CodeRabbit will review again

### For Teams

1. **Set Review Requirements:**
   - Go to repository Settings → Branches
   - Add branch protection rule
   - Require CodeRabbit review (if available)
   - Require at least one human reviewer

2. **Review Process:**
   - Developer creates PR
   - CodeRabbit provides automated review
   - Human reviewer reviews CodeRabbit feedback
   - Both reviews must pass before merge

## Troubleshooting

### CodeRabbit Not Reviewing PRs

**Problem:** No comments appear on PR

**Solutions:**
1. Check GitHub App is installed:
   - Go to repository Settings → Integrations → Installed GitHub Apps
   - Verify CodeRabbit is listed

2. Check App Permissions:
   - Go to CodeRabbit dashboard
   - Verify repository is connected
   - Check permissions are granted

3. Check GitHub Actions:
   - Go to Actions tab
   - Look for "CodeRabbit Review" workflow
   - Check for error messages

4. Verify Configuration:
   - Ensure `.coderabbit.yaml` exists in root
   - Check file syntax is valid YAML
   - Verify paths are correct

### Workflow Fails

**Problem:** GitHub Actions workflow fails

**Solutions:**
1. Check workflow file syntax:
   ```bash
   # Validate YAML
   npx js-yaml .github/workflows/coderabbit.yml
   ```

2. Check Node.js version:
   - Ensure Node 18+ is available
   - Update workflow if needed

3. Check dependencies:
   - Ensure `package.json` exists
   - Verify `npm ci` can run

### Too Many Comments

**Problem:** CodeRabbit is too verbose

**Solutions:**
1. Increase review threshold:
   ```yaml
   review:
     review_threshold: 80  # Only flag important issues
   ```

2. Review only changed files:
   ```yaml
   review:
     review_only_changed_files: true
   ```

3. Reduce max comments:
   ```yaml
   review:
     max_comments_per_file: 20
   ```

## Additional Resources

- **CodeRabbit Documentation**: [https://docs.coderabbit.ai](https://docs.coderabbit.ai)
- **GitHub App**: [https://github.com/marketplace/coderabbitai](https://github.com/marketplace/coderabbitai)
- **Project Setup Guide**: See `CODERABBIT_SETUP.md`
- **Contributing Guide**: See `CONTRIBUTING.md`

## Quick Checklist

- [ ] CodeRabbit GitHub App installed
- [ ] Repository selected in CodeRabbit
- [ ] Permissions granted
- [ ] `.coderabbit.yaml` committed to repository
- [ ] `.github/workflows/coderabbit.yml` committed
- [ ] Test PR created
- [ ] CodeRabbit review received
- [ ] Configuration customized (optional)
- [ ] Team notified about CodeRabbit integration

## Support

If you encounter issues:

1. Check CodeRabbit documentation
2. Review GitHub Actions logs
3. Check CodeRabbit dashboard for errors
4. Contact CodeRabbit support: [support@coderabbit.ai](mailto:support@coderabbit.ai)

---

**Ready to go!** Once you complete these steps, CodeRabbit will automatically review all your pull requests. 🎉

**Last Updated**: December 2024

