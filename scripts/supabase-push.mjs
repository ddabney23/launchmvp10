/**
 * Push supabase/migrations to linked remote project.
 * Loads .env.local, uses direct DB host (db.<ref>.supabase.co), repairs orphan remote versions.
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
  return r.status ?? 1
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

const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`

log(`Project ref: ${ref}`)
run(`npx supabase --version`)

const pwdEscaped = password.replace(/"/g, '\\"')
const linkStatus = run(`npx supabase link --project-ref ${ref} --password "${pwdEscaped}"`)
if (linkStatus !== 0) {
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
  if (repairStatus !== 0) {
    log('ERROR: migration repair failed')
    process.exit(repairStatus)
  }
}

const pushStatus = run(`npx supabase db push --db-url "${dbUrl}"`)
if (pushStatus !== 0) {
  log('ERROR: db push failed')
  process.exit(pushStatus)
}

log('SUCCESS: migrations pushed')
process.exit(0)
