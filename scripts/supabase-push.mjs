/**
 * Push supabase/migrations to linked remote project.
 * Loads .env.local, tries direct DB host then pooler fallback.
 */
import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const logPath = path.join(root, 'supabase-push.log')

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`
  fs.appendFileSync(logPath, line + '\n')
  console.log(msg)
}

function run(cmd, opts = {}) {
  log(`> ${cmd}`)
  const r = spawnSync(cmd, {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.stdout) log(r.stdout.trimEnd())
  if (r.stderr) log(r.stderr.trimEnd())
  return { status: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' }
}

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return m?.[1] || process.env.SUPABASE_PROJECT_REF || ''
}

function getDbPassword() {
  if (process.env.SUPABASE_DB_PASSWORD) {
    return process.env.SUPABASE_DB_PASSWORD
  }
  const url = process.env.DATABASE_URL || ''
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:'))
    return decodeURIComponent(u.password || '')
  } catch {
    return ''
  }
}

function getSupabaseRegion() {
  if (process.env.SUPABASE_REGION) return process.env.SUPABASE_REGION
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const m = url.match(/aws-0-([a-z0-9-]+)\.pooler\.supabase\.com/)
  if (m) return m[1]
  return process.env.SUPABASE_DEFAULT_REGION || 'us-east-2'
}

function buildDbUrls(ref, password) {
  const encoded = encodeURIComponent(password)
  return [
    {
      label: 'direct',
      url: `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`,
    },
    {
      label: 'pooler-transaction',
      url: `postgresql://postgres.${ref}:${encoded}@aws-0-${getSupabaseRegion()}.pooler.supabase.com:6543/postgres`,
    },
    {
      label: 'pooler-session',
      url: `postgresql://postgres.${ref}:${encoded}@aws-0-${getSupabaseRegion()}.pooler.supabase.com:5432/postgres`,
    },
  ]
}

function getLocalVersions() {
  const dir = path.join(root, 'supabase', 'migrations')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => {
      const m = f.match(/^(\d+)_/)
      return m ? m[1] : null
    })
    .filter(Boolean)
}

function getRemoteOnlyVersions() {
  const out = execSync('npx supabase migration list', {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  const local = new Set(getLocalVersions())
  const remoteOnly = []
  for (const line of out.split('\n')) {
    const parts = line.trim().split(/\s+/).filter(Boolean)
    if (parts.length < 2) continue
    const localVer = parts[0]
    const remoteVer = parts[1]
    if (/^\d+$/.test(remoteVer) && remoteVer !== '|' && !local.has(remoteVer)) {
      if (localVer === '' || localVer === '│' || !/^\d+$/.test(localVer)) {
        remoteOnly.push(remoteVer)
      }
    }
  }
  return [...new Set(remoteOnly)]
}

function tryDbPush(dbUrl, label, includeAll = false) {
  log(`Attempting db push via ${label}${includeAll ? ' --include-all' : ''}...`)
  const escaped = dbUrl.replace(/"/g, '\\"')
  const includeAllFlag = includeAll ? '--include-all' : ''
  return run(`npx supabase db push ${includeAllFlag} --db-url "${escaped}"`)
}

function shouldRetryIncludeAll(result) {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return output.includes('--include-all flag') || output.includes('found local migration files to be inserted before the last migration')
}

fs.writeFileSync(logPath, '')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

const ref = getProjectRef()
const password = getDbPassword()

if (!ref) {
  log('ERROR: Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_REF')
  process.exit(1)
}
if (!password) {
  log('ERROR: Set SUPABASE_DB_PASSWORD or DATABASE_URL with postgres password')
  process.exit(1)
}

log(`Project ref: ${ref}`)
run('npx supabase --version')

const pwdEscaped = password.replace(/"/g, '\\"')
const linkStatus = run(`npx supabase link --project-ref ${ref} --password "${pwdEscaped}"`)
if (linkStatus.status !== 0) {
  log('WARN: link returned non-zero (may already be linked); continuing with db push')
}

let remoteOnly = []
try {
  remoteOnly = getRemoteOnlyVersions()
} catch (e) {
  log(`WARN: could not parse migration list: ${e.message}`)
}

if (remoteOnly.length > 0) {
  log(`Repairing ${remoteOnly.length} remote-only migration version(s)...`)
  const batch = remoteOnly.join(' ')
  const repairStatus = run(`npx supabase migration repair --status reverted ${batch}`)
  if (repairStatus.status !== 0) {
    log('ERROR: migration repair failed')
    process.exit(repairStatus.status)
  }
}

const dbUrls = buildDbUrls(ref, password)
let pushStatus = 1
for (const { label, url } of dbUrls) {
  let result = tryDbPush(url, label)
  pushStatus = result.status
  if (pushStatus === 0) {
    log(`SUCCESS: migrations pushed via ${label}`)
    process.exit(0)
  }

  if (shouldRetryIncludeAll(result)) {
    log(`INFO: db push requires --include-all due to local migration order mismatch; retrying via ${label}`)
    result = tryDbPush(url, label, true)
    pushStatus = result.status
    if (pushStatus === 0) {
      log(`SUCCESS: migrations pushed via ${label} --include-all`)
      process.exit(0)
    }
    log(`WARN: db push --include-all failed via ${label}`)
    continue
  }

  log(`WARN: db push failed via ${label}`)
}

log('ERROR: db push failed on all connection methods (direct + pooler)')
log('')
log('Fallback: open Supabase Dashboard → SQL Editor and run:')
log('  scripts/apply-pending-migrations.sql')
log('Regenerate bundle: node scripts/build-apply-pending-migrations.mjs')
log('Verify: npm run supabase:migration:list')
process.exit(pushStatus)
