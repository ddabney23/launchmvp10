# AI Prompts Usage Guide

This guide explains how to use the AI assistant prompts for backend development.

## 📁 Available Prompt Files

1. **`BACKEND_DEVELOPMENT_PROMPT.md`** - Full detailed prompt for Cursor
   - Comprehensive guide with all patterns and examples
   - Best for: Cursor AI, detailed context needed

2. **`COPILOT_BACKEND_PROMPT.md`** - Concise prompt for GitHub Copilot
   - Shorter, more focused version
   - Best for: GitHub Copilot, quick reference

3. **`BACKEND_QUICK_REFERENCE.md`** - Quick lookup guide
   - Code snippets and patterns
   - Best for: Quick reference while coding

## 🚀 How to Use

### Option 1: Cursor AI (Recommended)

1. **Open Cursor Settings:**
   - Press `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)
   - Or go to: File → Preferences → Settings

2. **Navigate to AI Rules:**
   - Search for "Rules for AI" or "Cursor Rules"
   - Or go to: Features → Rules for AI

3. **Add the Prompt:**
   - Open `BACKEND_DEVELOPMENT_PROMPT.md`
   - Copy the entire content (everything after the first line)
   - Paste into the Cursor Rules field
   - Save

4. **Restart Cursor:**
   - Close and reopen Cursor for changes to take effect

**Result:** Cursor will now use this context for all code suggestions and chat interactions.

### Option 2: GitHub Copilot

1. **Create Instructions File:**
   ```bash
   # Create .copilot directory if it doesn't exist
   mkdir -p .copilot
   ```

2. **Copy Prompt:**
   - Open `COPILOT_BACKEND_PROMPT.md`
   - Copy the entire content
   - Create `.copilot/instructions.md` and paste

3. **Or Use in Chat:**
   - Open GitHub Copilot Chat
   - Copy the prompt from `COPILOT_BACKEND_PROMPT.md`
   - Paste at the start of your conversation

**Result:** Copilot will use this context for suggestions.

### Option 3: Quick Reference

- Keep `BACKEND_QUICK_REFERENCE.md` open while coding
- Use it as a cheat sheet for common patterns
- Copy code snippets as needed

## 💡 Usage Tips

### For New API Routes

1. Open `BACKEND_QUICK_REFERENCE.md`
2. Copy the route template
3. Ask AI: "Create a new API route for [feature] following the template"
4. AI will generate code following all patterns

### For Fixing Bugs

1. Show the AI the error or broken code
2. AI will automatically:
   - Check authentication patterns
   - Verify Supabase client usage
   - Fix error handling
   - Ensure proper types

### For Code Reviews

1. Ask: "Review this API route and ensure it follows all patterns"
2. AI will check:
   - Authentication
   - Error handling
   - Database access patterns
   - Type safety
   - Security checks

## 🎯 Example Prompts to Use

### Creating a New Route
```
Create a new API route at /api/posts/[id] that:
- Gets a post by ID
- Requires authentication
- Returns 404 if not found
- Follows all backend patterns
```

### Fixing a Route
```
Fix this API route - it's returning 500 errors:
[paste code]

Ensure it follows all patterns from BACKEND_DEVELOPMENT_PROMPT.md
```

### Debugging
```
Debug this database query issue:
[describe problem]

Check if I'm using the correct Supabase client and RLS policies.
```

### Adding Features
```
Add pagination to the /api/admin/users/search endpoint.
Use cursor-based pagination and follow existing patterns.
```

## ✅ Verification

After setting up, test that it's working:

1. **Ask AI a simple question:**
   ```
   How do I authenticate a user in an API route?
   ```

2. **Expected Response:**
   - Should mention `getClerkUserId()` from `@/lib/clerk-auth`
   - Should show the try/catch pattern
   - Should reference error handling

3. **If not working:**
   - Check that you copied the entire prompt
   - Restart Cursor/Copilot
   - Verify the file path is correct

## 📝 Customization

You can customize the prompts by:

1. **Adding project-specific patterns:**
   - Add your own conventions
   - Include team-specific rules
   - Add domain-specific examples

2. **Updating route lists:**
   - Add new routes as you create them
   - Update patterns as they evolve
   - Keep documentation in sync

3. **Adding examples:**
   - Include real examples from your codebase
   - Add common use cases
   - Document edge cases

## 🔄 Keeping Prompts Updated

When you:
- Add new API routes → Update the route list
- Change patterns → Update the templates
- Fix common issues → Add to "Common Mistakes"
- Add new features → Update examples

**Pro Tip:** Keep `BACKEND_QUICK_REFERENCE.md` updated as you code - it's the fastest way to maintain consistency.

## 🆘 Troubleshooting

### AI not following patterns?
- Check that prompt was copied completely
- Restart the AI tool
- Try being more explicit: "Follow the pattern from BACKEND_DEVELOPMENT_PROMPT.md"

### Getting wrong imports?
- Verify the prompt includes correct import paths
- Check that file paths match your project structure
- Update paths in the prompt if needed

### Missing error handling?
- Remind AI: "Use handleApiError() from @/lib/api-error"
- Check that error handling section is in the prompt
- Verify the file exists in your project

## 📚 Related Documentation

- `API_DOCUMENTATION.md` - Complete API reference
- `API_ROUTES_VERIFICATION.md` - Route status
- `HOW_IT_WORKS.md` - System architecture
- `README.md` - Project overview

---

**Need Help?** Check the prompt files themselves - they contain all the patterns and examples you need!

