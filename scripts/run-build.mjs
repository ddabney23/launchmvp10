/**
 * Production build entry: uses NTFS mirror on exFAT/non-NTFS drives (Windows).
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function getProjectDriveLetter(projectRoot) {
  const parsed = path.parse(path.resolve(projectRoot))
  const rootDir = parsed.root
  if (!rootDir || process.platform !== 'win32') return null
  const letter = rootDir.replace(/[\\/:]/g, '').charAt(0)
  return letter ? letter.toUpperCase() : null
}

function getDriveFileSystem(driveLetter) {
  if (!driveLetter || process.platform !== 'win32') {
    return 'NTFS'
  }
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-Volume -DriveLetter '${driveLetter}' -ErrorAction SilentlyContinue).FileSystemType`,
    ],
    { encoding: 'utf8' }
  )
  const fsType = (ps.stdout || '').trim()
  return fsType || 'Unknown'
}

function runLocalBuild() {
  console.log('[build] Running next build --webpack in project directory...')
  const r = spawnSync('npm', ['run', 'build:local'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  return r.status ?? 1
}

function runNtfsMirrorBuild() {
  const script = path.join(root, 'scripts', 'build-ntfs.ps1')
  console.log(
    '[build] Project drive is exFAT or non-NTFS. Next.js needs symlinks/junctions under node_modules and .next, which this filesystem does not support (EISDIR/readlink errors).'
  )
  console.log('[build] Mirroring to %LOCALAPPDATA%\\optimix-mvp-build (NTFS) and building there...')
  const r = spawnSync(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', script],
    { cwd: root, stdio: 'inherit', shell: false, env: process.env }
  )
  return r.status ?? 1
}

process.chdir(root)
const driveLetter = getProjectDriveLetter(root)
const fsType = getDriveFileSystem(driveLetter)

console.log(`[build] Project root: ${root}`)
if (driveLetter) {
  console.log(`[build] Drive ${driveLetter}: file system = ${fsType}`)
}

const needsMirror =
  process.platform === 'win32' &&
  fsType &&
  fsType.toUpperCase() !== 'NTFS'

const exitCode = needsMirror ? runNtfsMirrorBuild() : runLocalBuild()
process.exit(exitCode)
