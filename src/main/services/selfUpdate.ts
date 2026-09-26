import { app } from 'electron'
import { spawn } from 'child_process'
import {
  accessSync,
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'
import { getSettings } from '../repositories/settingsRepo'
import { createBackup } from './backup'
import { isNewerVersion } from '@shared/appVersion'
import type { AppUpdateInfo, AppUpdateProgress } from '@shared/types'
import { normalizePortalUrl, portalUrlProblem } from '@shared/portalUrl'
import { downloadAsset, fetchLatestRelease, pickAsset, type InstallKind } from './selfUpdateCore'

/** How this copy of EduBoard was installed, which decides how it replaces itself; or
 * why it can't (running from source, from the Mac disk image…). */
function installKind(): { kind: InstallKind } | { reason: string } {
  if (!app.isPackaged) return { reason: 'This copy runs from source code, not an installed app.' }
  if (process.platform === 'win32') {
    return { kind: process.env.PORTABLE_EXECUTABLE_FILE ? 'windows-portable' : 'windows-installer' }
  }
  if (process.platform === 'darwin') {
    const bundle = macAppBundle()
    if (!bundle) return { reason: 'Couldn’t find the EduBoard app to replace.' }
    if (bundle.startsWith('/Volumes/')) {
      return { reason: 'EduBoard is running from its disk image. Drag it into Applications first.' }
    }
    if (!isWritable(dirname(bundle))) {
      return { reason: `EduBoard can’t replace itself in ${dirname(bundle)}.` }
    }
    return { kind: 'mac' }
  }
  if (process.platform === 'linux') {
    const appImage = process.env.APPIMAGE
    if (!appImage) return { reason: 'Only the AppImage version can update itself.' }
    if (!isWritable(dirname(appImage)))
      return { reason: `EduBoard can’t replace itself in ${dirname(appImage)}.` }
    return { kind: 'linux-appimage' }
  }
  return { reason: 'Updating from inside EduBoard isn’t supported on this system.' }
}

function isWritable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** /Applications/EduBoard.app from …/EduBoard.app/Contents/MacOS/EduBoard. */
function macAppBundle(): string | null {
  const exe = app.getPath('exe')
  const i = exe.indexOf('.app/')
  return i === -1 ? null : exe.slice(0, i + 4)
}

function portalUrl(): string | null {
  const url = normalizePortalUrl(getSettings().portalUrl)
  return url && !portalUrlProblem(url) ? url : null
}

export async function getAppUpdateInfo(): Promise<AppUpdateInfo> {
  const current = app.getVersion()
  const where = installKind()
  const base = {
    current,
    canInstall: 'kind' in where,
    cannotInstallReason: 'reason' in where ? where.reason : null
  }
  try {
    const release = await fetchLatestRelease(portalUrl())
    return {
      ...base,
      latest: release.version,
      updateAvailable: isNewerVersion(release.version, current),
      problem: null
    }
  } catch (err) {
    return { ...base, latest: null, updateAvailable: false, problem: (err as Error).message }
  }
}

let progress: AppUpdateProgress = { phase: 'idle', fraction: 0, error: null }

export function getAppUpdateProgress(): AppUpdateProgress {
  return progress
}

/** Backs up, downloads the new version, then hands over to a small helper that waits
 * for EduBoard to close, puts the new version in place and reopens it. */
export async function installAppUpdate(): Promise<void> {
  if (progress.phase === 'downloading' || progress.phase === 'installing') return
  const where = installKind()
  if (!('kind' in where)) throw new Error(where.reason)
  progress = { phase: 'downloading', fraction: 0, error: null }
  try {
    createBackup()
    const release = await fetchLatestRelease(portalUrl())
    const asset = pickAsset(where.kind, process.arch, release.assets)
    if (!asset) throw new Error('The newest release has no download for this computer.')
    const dir = join(app.getPath('temp'), 'eduboard-update')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, asset.name)
    if (existsSync(file)) unlinkSync(file)
    await downloadAsset(asset, file, (fraction) => {
      progress = { phase: 'downloading', fraction, error: null }
    })
    progress = { phase: 'installing', fraction: 1, error: null }
    startInstaller(where.kind, file, dir)
    // Give the helper a moment to start before this window goes away.
    setTimeout(() => app.quit(), 800)
  } catch (err) {
    progress = { phase: 'failed', fraction: 0, error: (err as Error).message }
    throw err
  }
}

const shQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

function startInstaller(kind: InstallKind, file: string, dir: string): void {
  const detached = { detached: true, stdio: 'ignore' as const, windowsHide: true }
  const pid = process.pid
  if (kind === 'windows-installer') {
    // The installer closes any EduBoard still running, installs quietly, then reopens it.
    spawn(file, ['/S', '--force-run'], detached).unref()
    return
  }
  if (kind === 'windows-portable') {
    const target = process.env.PORTABLE_EXECUTABLE_FILE!
    const script = join(dir, 'finish-update.cmd')
    writeFileSync(
      script,
      [
        '@echo off',
        ':wait',
        `tasklist /FI "PID eq ${pid}" | find "${pid}" >nul && (timeout /t 1 >nul & goto wait)`,
        `move /y "${file}" "${target}" >nul`,
        `start "" "${target}"`,
        'del "%~f0"'
      ].join('\r\n')
    )
    spawn('cmd.exe', ['/c', script], detached).unref()
    return
  }
  if (kind === 'mac') {
    const target = macAppBundle()!
    const script = join(dir, 'finish-update.sh')
    writeFileSync(
      script,
      `#!/bin/bash
# Waits for EduBoard to close, swaps in the new app (keeping the old one if anything
# goes wrong), and reopens it.
while kill -0 ${pid} 2>/dev/null; do sleep 1; done
MNT=$(mktemp -d)
hdiutil attach -nobrowse -readonly -mountpoint "$MNT" ${shQuote(file)} >/dev/null || { open ${shQuote(target)}; exit 1; }
NEW=$(ls -d "$MNT"/*.app | head -1)
rm -rf ${shQuote(target + '.old')}
if mv ${shQuote(target)} ${shQuote(target + '.old')} && cp -R "$NEW" ${shQuote(target)}; then
  rm -rf ${shQuote(target + '.old')}
else
  rm -rf ${shQuote(target)}; mv ${shQuote(target + '.old')} ${shQuote(target)}
fi
hdiutil detach "$MNT" >/dev/null
xattr -dr com.apple.quarantine ${shQuote(target)} 2>/dev/null
open ${shQuote(target)}
`
    )
    spawn('/bin/bash', [script], detached).unref()
    return
  }
  // Linux AppImage: a running AppImage can be replaced on disk; the new one starts
  // once this one has closed.
  const target = process.env.APPIMAGE!
  const staged = `${target}.new`
  copyFileSync(file, staged)
  chmodSync(staged, 0o755)
  renameSync(staged, target)
  const script = join(dir, 'finish-update.sh')
  writeFileSync(
    script,
    `#!/bin/sh
while kill -0 ${pid} 2>/dev/null; do sleep 1; done
exec ${shQuote(target)}
`
  )
  spawn('/bin/sh', [script], detached).unref()
}
