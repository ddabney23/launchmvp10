# ⚡ CodeRabbit Quick Start

Get CodeRabbit up and running in 5 minutes!

## 🚀 Quick Setup (5 Steps)

### 1. Install GitHub App
👉 [Install CodeRabbit](https://github.com/marketplace/coderabbitai) → Select your repository → Install

### 2. Verify Files Are Committed
```bash
git add .coderabbit.yaml .github/workflows/coderabbit.yml
git commit -m "feat: add CodeRabbit integration"
git push
```

### 3. Create Test PR
```bash
git checkout -b test/coderabbit
git add test-coderabbit.ts
git commit -m "test: CodeRabbit integration"
git push origin test/coderabbit
```
Then create PR on GitHub.

### 4. Wait for Review
CodeRabbit will review your PR automatically (usually within 5-10 minutes).

### 5. Check Results
Look for comments from `coderabbit[bot]` on your PR.

## ✅ Verification Checklist

- [ ] GitHub App installed
- [ ] Repository selected
- [ ] Configuration files committed
- [ ] Test PR created
- [ ] CodeRabbit comments received

## 🆘 Not Working?

1. **Check GitHub App**: Settings → Integrations → Installed GitHub Apps
2. **Check Actions**: Actions tab → Look for "CodeRabbit Review" workflow
3. **Check Permissions**: CodeRabbit needs read/write access to PRs

## 📖 Full Documentation

- **Setup Guide**: [CODERABBIT_NEXT_STEPS.md](./CODERABBIT_NEXT_STEPS.md)
- **Configuration**: [CODERABBIT_SETUP.md](./CODERABBIT_SETUP.md)
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**That's it!** CodeRabbit will now review all your PRs automatically. 🎉

