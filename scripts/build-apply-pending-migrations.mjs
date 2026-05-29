/**
 * Build scripts/apply-pending-migrations.sql from supabase/migrations 053–057.
 * Run: node scripts/build-apply-pending-migrations.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'supabase', 'migrations')
const outPath = path.join(root, 'scripts', 'apply-pending-migrations.sql')

const files = [
  '053_security_rls_tighten.sql',
  '054_fix_is_admin_rls_recursion.sql',
  '055_fix_profiles_update_rls.sql',
  '056_fix_posts_rls.sql',
  '057_fix_social_marketplace_rls.sql',
]

const header = `-- apply-pending-migrations.sql (auto-generated)
-- Apply in Supabase Dashboard → SQL Editor when npm run supabase:push fails.
-- Regenerate: node scripts/build-apply-pending-migrations.mjs
--
-- Migrations included: ${files.join(', ')}

`

let body = header
for (const file of files) {
  const full = path.join(migrationsDir, file)
  if (!fs.existsSync(full)) {
    console.error(`Missing: ${full}`)
    process.exit(1)
  }
  body += `\n-- ========== ${file} ==========\n\n`
  body += fs.readFileSync(full, 'utf8').trim()
  body += '\n\n'
}

fs.writeFileSync(outPath, body)
console.log(`Wrote ${outPath}`)
