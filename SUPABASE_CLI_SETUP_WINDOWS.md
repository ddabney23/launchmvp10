# 🔧 Supabase CLI Setup for Windows

## ⚠️ npm install -g supabase Doesn't Work on Windows!

Supabase CLI needs to be installed using one of these methods:

---

## ✅ METHOD 1: Scoop (Recommended for Windows)

### Step 1: Install Scoop (if you don't have it)

```powershell
# Run in PowerShell (as regular user, not admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

### Step 2: Install Supabase CLI

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Step 3: Verify Installation

```powershell
supabase --version
```

---

## ✅ METHOD 2: Direct Download (Windows Installer)

### Download & Install:

1. Go to: https://github.com/supabase/cli/releases/latest
2. Download: `supabase_windows_amd64.zip`
3. Extract the ZIP file
4. Move `supabase.exe` to a folder in your PATH
   - Example: `C:\Program Files\Supabase\`
5. Add to PATH if needed

### Verify:

```powershell
supabase --version
```

---

## ✅ METHOD 3: Use npx Instead (Easiest - No Installation!)

**You can run Supabase commands with `npx` without installing!**

```bash
# Login
npx supabase login

# Link project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
npx supabase db push
```

**This is the simplest method - just use `npx supabase` instead of `supabase`!**

---

## 🎯 RECOMMENDED: Use npx Method

Since you want to proceed quickly, **use Method 3 (npx)**:

### Step 1: Login to Supabase

```bash
npx supabase login
```

**This will:**
- Open your browser
- Ask you to authenticate
- Connect your terminal to Supabase

### Step 2: Find Your Project Reference

1. Go to https://app.supabase.com
2. Select your project
3. Look at URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`
4. Copy the `YOUR_PROJECT_REF` part

**Example**: If URL is `https://app.supabase.com/project/abcdefghijklmnop`  
Then `YOUR_PROJECT_REF` is `abcdefghijklmnop`

### Step 3: Link Your Project

```bash
npx supabase link --project-ref YOUR_PROJECT_REF_HERE
```

**When prompted for database password:**
- Enter your Supabase database password
- (The one you set when creating the project)

### Step 4: Push All 20 Migrations

```bash
npx supabase db push
```

**This applies all migrations automatically!**

**Expected output:**
```
Applying migration 001_init_schema.sql...
Applying migration 002_rls_policies.sql...
...
✓ Finished supabase db push
```

---

## 🎯 YOUR COMMANDS TO RUN NOW

**Copy and paste these one by one:**

```bash
# 1. Login to Supabase
npx supabase login

# 2. Link project (replace YOUR_REF with your actual project ref)
npx supabase link --project-ref YOUR_REF

# 3. Push all migrations
npx supabase db push
```

---

## 🆘 IF YOU GET ERRORS

### "Project not found"
- Double-check your project reference ID
- Make sure you're logged in to the right account

### "Database password incorrect"
- Reset in Supabase Dashboard → Settings → Database
- Use the new password when prompted

### "Permission denied"
- Make sure you own the Supabase project
- Check you're logged in with correct account

---

## ✅ AFTER MIGRATIONS

Once migrations are applied, you'll run:

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Then create your .env.local
# (I'll help you with this next!)
```

---

**Status**: Ready for Supabase CLI setup  
**Method**: npx (no installation needed!)  
**Time**: 5 minutes  
**Next Command**: `npx supabase login`

