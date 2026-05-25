# Console Log Replacement Guide

This guide documents the systematic replacement of console logging with the centralized logger utility.

---

## **Overview**

Replace all `console.log`, `console.error`, `console.warn`, and `console.debug` statements with the centralized `logger` utility from `src/lib/logger.ts`.

---

## **Logger API**

```typescript
import { logger } from '@/lib/logger';

// Debug level (development only)
logger.debug('Debug message', { data });

// Info level
logger.info('Info message', { data });

// Warning level
logger.warn('Warning message', { error });

// Error level
logger.error('Error message', error);
```

---

## **Replacement Patterns**

### **Pattern 1: console.log → logger.debug/info**

```typescript
// Before
console.log('User logged in:', userId);

// After (for debug messages)
logger.debug('User logged in', { userId });

// After (for important events)
logger.info('User logged in', { userId });
```

### **Pattern 2: console.error → logger.error**

```typescript
// Before
console.error('Failed to fetch data:', error);

// After
logger.error('Failed to fetch data:', error);
```

### **Pattern 3: console.warn → logger.warn**

```typescript
// Before
console.warn('Deprecated API used');

// After
logger.warn('Deprecated API used');
```

### **Pattern 4: Structured logging**

```typescript
// Before
console.log('[MODULE] Event happened:', value1, value2);

// After
logger.info('Module event happened', {
  module: 'MODULE',
  value1,
  value2,
});
```

---

## **Files Requiring Updates**

### **High Priority (Most console logs)**

1. **`src/views/VendorOnboarding.tsx`** - 49 console statements
2. **`src/views/Profile.tsx`** - ~20 console statements
3. **`src/views/Marketplace.tsx`** - ~15 console statements
4. **`src/views/Messages.tsx`** - ~10 console statements
5. **`src/views/Feed.tsx`** - ~10 console statements

### **Medium Priority**

6. **`src/views/CreatePost.tsx`**
7. **`src/views/CustomerOnboarding.tsx`**
8. **`src/views/OnboardingFunnel.tsx`**
9. **`src/views/NotFound.tsx`**
10. **`src/views/AdminDashboard.tsx`**

### **API Routes** (Already using logger in many places)

- Most API routes already use `logger.error()`
- Check for remaining `console.log()` in development/debug code

---

## **Automated Replacement Script**

### **Using VS Code Search & Replace**

1. Open VS Code Search (Ctrl+Shift+F)
2. Enable Regex mode
3. Search for: `console\.(log|error|warn|debug)\((.*?)\)`
4. Replace based on context:
   - Debug messages: `logger.debug($2)`
   - Errors: `logger.error($2)`
   - Warnings: `logger.warn($2)`
   - Info: `logger.info($2)`

### **Using Node Script**

```javascript
// scripts/replace-console-logs.js
const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Add logger import if not present
  if (!content.includes("from '@/lib/logger'") && content.match(/console\.(log|error|warn|debug)/)) {
    content = `import { logger } from '@/lib/logger';\n` + content;
    modified = true;
  }

  // Replace console.error
  if (content.includes('console.error')) {
    content = content.replace(/console\.error\(/g, 'logger.error(');
    modified = true;
  }

  // Replace console.warn
  if (content.includes('console.warn')) {
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    modified = true;
  }

  // Replace console.debug (development logging)
  if (content.includes('console.debug')) {
    content = content.replace(/console\.debug\(/g, 'logger.debug(');
    modified = true;
  }

  // Replace console.log with logger.debug (can be changed to info if needed)
  if (content.includes('console.log')) {
    content = content.replace(/console\.log\(/g, 'logger.debug(');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
  }
}

// Run on all TypeScript files in src/
const srcDir = path.join(__dirname, '../src');
// Implementation would recursively process files
```

---

## **Testing After Replacement**

1. **Verify imports:**
   ```typescript
   import { logger } from '@/lib/logger';
   ```

2. **Check log output:**
   - Development: All logs appear in console
   - Production: Only warn/error logs appear

3. **Test error tracking:**
   - Errors should be sent to Sentry (if configured)
   - Structured data should be properly formatted

---

## **Best Practices**

### **DO:**
- ✅ Use `logger.debug()` for development-only logs
- ✅ Use `logger.info()` for important events
- ✅ Use `logger.warn()` for warnings
- ✅ Use `logger.error()` for errors
- ✅ Pass structured data as second argument
- ✅ Use descriptive messages

### **DON'T:**
- ❌ Mix console and logger in same file
- ❌ Log sensitive data (passwords, tokens, PII)
- ❌ Use `console.log()` in production code
- ❌ Log excessively in loops
- ❌ Use string concatenation for structured data

---

## **Example: VendorOnboarding.tsx**

### **Before:**
```typescript
console.log('[VENDOR ONBOARDING] Starting submission with user:', {
  userId,
  clerkId: user.id,
  timestamp: new Date().toISOString(),
});

console.error('[VENDOR ONBOARDING] File upload error:', uploadError);

console.warn('[VENDOR ONBOARDING] Banner upload failed (non-critical):', bannerError);
```

### **After:**
```typescript
logger.info('Vendor onboarding submission started', {
  userId,
  clerkId: user.id,
  timestamp: new Date().toISOString(),
});

logger.error('Vendor onboarding file upload failed:', uploadError);

logger.warn('Vendor onboarding banner upload failed (non-critical):', bannerError);
```

---

## **Progress Tracking**

| File | Console Statements | Status |
|------|-------------------|--------|
| `src/views/VendorOnboarding.tsx` | 49 | ⏳ Pending |
| `src/views/Profile.tsx` | ~20 | ⏳ Pending |
| `src/views/Marketplace.tsx` | ~15 | ⏳ Pending |
| `src/views/Messages.tsx` | ~10 | ⏳ Pending |
| `src/views/Feed.tsx` | ~10 | ⏳ Pending |
| `src/lib/trending.ts` | 0 | ✅ Complete |
| API Routes | ~5 | ⏳ Pending |

**Total Estimated:** ~150-200 console statements to replace

---

## **Completion Checklist**

- [ ] Run search for remaining console logs
- [ ] Update all `console.error` to `logger.error`
- [ ] Update all `console.warn` to `logger.warn`
- [ ] Update all `console.log` to `logger.debug` or `logger.info`
- [ ] Add logger imports where missing
- [ ] Test logging in development
- [ ] Test logging in production
- [ ] Verify Sentry integration (if enabled)
- [ ] Update any documentation mentioning console logs

---

## **Quick Command**

Search for remaining console logs:
```bash
# Windows PowerShell
Select-String -Path "src\**\*.ts*" -Pattern "console\.(log|error|warn|debug)" | Select-Object -ExpandProperty Path -Unique

# Unix/Mac
grep -r "console\.\(log\|error\|warn\|debug\)" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort -u
```

---

## **Notes**

- This is a **gradual migration** - can be done incrementally
- Priority should be given to error-prone files (views, API routes)
- Some console.logs in development scripts can remain
- Consider adding ESLint rule to prevent new console logs:

```json
// .eslintrc.json
{
  "rules": {
    "no-console": ["warn", {
      "allow": []
    }]
  }
}
```

