# 🚀 Next.js + Tailwind CSS v4 Master Troubleshooting Prompt

Use this comprehensive prompt to diagnose and fix common issues when running `npm run dev` in a Next.js application with Tailwind CSS v4.

---

## 🎯 Quick Diagnostic Checklist

Before running `npm run dev`, verify:

### 1. Directory Structure
- [ ] Only `app/` directory exists (no `pages/` directory at root)
- [ ] `src/pages/` has been renamed to `src/views/` or similar
- [ ] No conflicting routing directories

### 2. Tailwind CSS v4 Configuration
- [ ] `package.json` has `"tailwindcss": "^4"` and `"@tailwindcss/postcss": "^4"`
- [ ] `postcss.config.mjs` uses `@tailwindcss/postcss` plugin
- [ ] `app/globals.css` uses `@import "tailwindcss"` (not `@tailwind` directives)
- [ ] CSS variables are defined in `:root` and `.dark` selectors

### 3. Environment Variables
- [ ] `.env.local` file exists with required variables
- [ ] All `NEXT_PUBLIC_*` variables are set
- [ ] No `VITE_*` variables remain (should be `NEXT_PUBLIC_*`)

### 4. Dependencies
- [ ] All React Router dependencies removed
- [ ] All Vite dependencies removed
- [ ] Next.js 13+ installed
- [ ] React 18+ installed
- [ ] `@tanstack/react-query` installed
- [ ] `@supabase/supabase-js` installed
- [ ] All Radix UI packages installed (for shadcn/ui components)
- [ ] `react-hook-form`, `zod`, `@hookform/resolvers` installed
- [ ] `date-fns`, `lucide-react`, `next-themes`, `sonner` installed
- [ ] `clsx`, `tailwind-merge`, `class-variance-authority` installed

---

## 🔧 Common Error Fixes

### Error 1: "Cannot apply unknown utility class `border-border`"

**Cause**: Tailwind CSS v4 syntax change - `@apply` with CSS variables works differently.

**Fix**:
```css
/* ❌ Wrong (Tailwind v3) */
@layer base {
  * {
    @apply border-border;
  }
}

/* ✅ Correct (Tailwind v4) */
@layer base {
  * {
    border-color: hsl(var(--border));
  }
}
```

**Alternative Fix** (if you want to use @apply):
```css
@layer base {
  * {
    @apply border-[hsl(var(--border))];
  }
}
```

### Error 2: "pages and app directories should be under the same folder"

**Cause**: Next.js detected both `pages/` and `app/` directories.

**Fix**:
1. Rename `src/pages/` to `src/views/` or `src/screens/`
2. Update all imports from `@/pages/*` to `@/views/*`
3. Verify no `pages/` directory exists at root level

### Error 3: "Module not found: Can't resolve 'react-router-dom'"

**Cause**: Code still imports from React Router.

**Fix**:
1. Find all `react-router-dom` imports: `grep -r "react-router-dom" src/`
2. Replace:
   - `useNavigate` → `useRouter` from `next/navigation`
   - `Link` from `react-router-dom` → `Link` from `next/link`
   - `useParams` → use `params` prop in page components
   - `useSearchParams` from `react-router-dom` → `useSearchParams` from `next/navigation`

### Error 4: "Cannot find module '@/pages/...'"

**Cause**: Directory renamed but imports not updated.

**Fix**:
1. Verify directory exists: `ls src/views/` (or your new name)
2. Update all imports: `find . -type f -name "*.tsx" -exec sed -i 's/@\/pages\//@\/views\//g' {} +`
3. Check `tsconfig.json` paths configuration

### Error 5: "import.meta.env is not defined"

**Cause**: Vite syntax in Next.js code.

**Fix**:
Replace all instances:
- `import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`
- `import.meta.env.PROD` → `process.env.NODE_ENV === 'production'`
- `import.meta.env.DEV` → `process.env.NODE_ENV === 'development'`
- `import.meta.env.MODE` → `process.env.NODE_ENV`

### Error 6: Tailwind CSS not working / styles not applying

**Cause**: Tailwind v4 configuration issue.

**Fix**:
1. Verify `postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

2. Verify `app/globals.css` starts with:
```css
@import "tailwindcss";
```

3. Verify `app/layout.tsx` imports globals.css:
```tsx
import './globals.css'
```

4. Clear cache and rebuild:
```bash
rm -rf .next node_modules/.cache
npm run dev
```

### Error 7: "Hydration failed" or "Text content does not match"

**Cause**: Server/client mismatch, often from using browser-only APIs.

**Fix**:
1. Ensure components using browser APIs have `'use client'` directive
2. Wrap browser API calls in `typeof window !== 'undefined'` checks
3. Use `useEffect` for client-only code

### Error 8: "useRouter() should be wrapped in a Router"

**Cause**: Using Next.js router in wrong context.

**Fix**:
- Use `useRouter` from `next/navigation` (not `next/router`)
- Ensure component has `'use client'` directive
- Don't use router in Server Components

### Error 9: "Cannot read property 'push' of undefined"

**Cause**: Router not initialized properly.

**Fix**:
```tsx
'use client'
import { useRouter } from 'next/navigation'

export default function Component() {
  const router = useRouter() // ✅ Correct
  // Not: const { push } = useRouter() ❌
  
  router.push('/path') // ✅ Correct
}
```

### Error 10: "Module not found: Can't resolve '@tanstack/react-query'"

**Cause**: Missing dependency in `package.json`.

**Fix**:
```bash
npm install @tanstack/react-query
```

**Common Missing Dependencies**:
```bash
# Core dependencies
npm install @tanstack/react-query @supabase/supabase-js

# Form handling
npm install react-hook-form @hookform/resolvers zod

# UI utilities
npm install date-fns lucide-react next-themes sonner
npm install clsx tailwind-merge class-variance-authority

# Radix UI (for shadcn/ui components)
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog \
  @radix-ui/react-aspect-ratio @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-collapsible \
  @radix-ui/react-context-menu @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-hover-card \
  @radix-ui/react-label @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu @radix-ui/react-popover \
  @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slider \
  @radix-ui/react-slot @radix-ui/react-switch \
  @radix-ui/react-tabs @radix-ui/react-toast \
  @radix-ui/react-toggle @radix-ui/react-toggle-group \
  @radix-ui/react-tooltip

# Additional UI libraries
npm install cmdk embla-carousel-react react-day-picker vaul \
  input-otp recharts react-resizable-panels
```

### Error 11: TypeScript errors with dynamic routes

**Cause**: Page component params typing.

**Fix**:
```tsx
// ✅ Correct
export default function Page({
  params,
}: {
  params: { id: string }
}) {
  return <div>{params.id}</div>
}

// For async params (Next.js 15+):
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <div>{id}</div>
}
```

---

## 📋 Pre-Launch Verification Script

Run these commands before `npm run dev`:

```bash
# 1. Check for conflicting directories
if [ -d "pages" ] && [ -d "app" ]; then
  echo "❌ ERROR: Both 'pages' and 'app' directories exist!"
  exit 1
fi

# 2. Check for React Router imports
if grep -r "react-router-dom" src/ app/ --include="*.tsx" --include="*.ts"; then
  echo "⚠️  WARNING: Found react-router-dom imports"
fi

# 3. Check for Vite imports
if grep -r "import.meta.env" src/ app/ --include="*.tsx" --include="*.ts"; then
  echo "⚠️  WARNING: Found import.meta.env (should be process.env)"
fi

# 4. Check Tailwind CSS syntax
if grep -q "@tailwind" app/globals.css; then
  echo "⚠️  WARNING: Using old Tailwind syntax (should use @import)"
fi

# 5. Verify required files exist
required_files=("app/layout.tsx" "app/globals.css" "next.config.ts" "tsconfig.json")
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ ERROR: Missing required file: $file"
    exit 1
  fi
done

echo "✅ All checks passed!"
```

---

## 🔍 Debugging Steps

### Step 1: Clean Build
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

### Step 2: Check Tailwind Configuration
```bash
# Verify PostCSS config
cat postcss.config.mjs

# Verify globals.css syntax
head -5 app/globals.css
```

### Step 3: Verify Dependencies
```bash
npm list tailwindcss @tailwindcss/postcss next react react-dom
```

### Step 4: Check for Type Errors
```bash
npx tsc --noEmit
```

### Step 5: Check for Lint Errors
```bash
npm run lint
```

---

## 🎨 Tailwind CSS v4 Specific Issues

### Issue: CSS Variables Not Working

**Solution**: Ensure variables are defined correctly:
```css
:root {
  --border: 240 6% 90%; /* ✅ HSL values without hsl() */
}

/* Then use: */
border-color: hsl(var(--border)); /* ✅ Wrap in hsl() when using */
```

### Issue: Dark Mode Not Working

**Solution**: Ensure `.dark` class is applied to `<html>`:
```tsx
// app/layout.tsx
<html lang="en" className="dark"> {/* or use ThemeProvider */}
```

### Issue: Custom Utilities Not Working

**Solution**: Define in `@layer utilities`:
```css
@layer utilities {
  .custom-utility {
    /* your styles */
  }
}
```

---

## 🚨 Critical Configuration Files

### 1. `next.config.ts`
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
```

### 2. `postcss.config.mjs`
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### 3. `tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 4. `app/globals.css` (Tailwind v4)
```css
@import "tailwindcss";

@layer base {
  :root {
    --border: 240 6% 90%;
    /* ... other variables */
  }
  
  * {
    border-color: hsl(var(--border));
  }
}
```

---

## ✅ Final Checklist Before `npm run dev`

- [ ] No `pages/` directory at root
- [ ] `app/globals.css` uses `@import "tailwindcss"`
- [ ] All `@apply` directives use valid syntax or direct CSS
- [ ] All `import.meta.env` replaced with `process.env`
- [ ] All React Router imports replaced with Next.js equivalents
- [ ] All client components have `'use client'` directive
- [ ] Environment variables set in `.env.local`
- [ ] `postcss.config.mjs` configured for Tailwind v4
- [ ] All required dependencies installed (check `package.json`)
- [ ] `@tanstack/react-query` installed
- [ ] `@supabase/supabase-js` installed
- [ ] All Radix UI packages installed (if using shadcn/ui)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No lint errors (`npm run lint`)

---

## 🎯 Quick Fix Commands

```bash
# Fix Tailwind CSS v4 syntax
sed -i 's/@tailwind base;/@import "tailwindcss";/g' app/globals.css
sed -i 's/@tailwind components;//g' app/globals.css
sed -i 's/@tailwind utilities;//g' app/globals.css

# Fix @apply border-border
sed -i 's/@apply border-border;/border-color: hsl(var(--border));/g' app/globals.css

# Fix @apply with CSS variables
sed -i 's/@apply bg-background text-foreground;/background-color: hsl(var(--background)); color: hsl(var(--foreground));/g' app/globals.css

# Find and replace import.meta.env
find src app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/import\.meta\.env\.VITE_/process.env.NEXT_PUBLIC_/g' {} +
find src app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/import\.meta\.env\.PROD/process.env.NODE_ENV === '\''production'\''/g' {} +
find src app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/import\.meta\.env\.DEV/process.env.NODE_ENV === '\''development'\''/g' {} +
```

---

## 🔄 Additional Common Issues

### Issue: "Module not found: Can't resolve '@/components/...'"

**Fix**: Verify `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Issue: "Cannot use import statement outside a module"

**Fix**: Ensure `package.json` has `"type": "module"` OR use `.mjs` extension for config files.

### Issue: "ReferenceError: window is not defined"

**Fix**: 
```tsx
'use client' // Add this directive

// Or wrap in check:
if (typeof window !== 'undefined') {
  // browser-only code
}
```

### Issue: "Error: useSearchParams() should be wrapped in a suspense boundary"

**Fix**:
```tsx
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SearchComponent() {
  const searchParams = useSearchParams()
  // ...
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchComponent />
    </Suspense>
  )
}
```

---

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Next.js App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)

---

**Use this prompt whenever you encounter issues running `npm run dev`. It covers the most common Next.js + Tailwind v4 migration issues.**

