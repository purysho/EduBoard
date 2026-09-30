import { AppError } from '@shared/errorCodes'
import { app, BrowserWindow, Notification } from 'electron'
import { spawn } from 'child_process'
import {
  accessSync,
  chmodSync,
  constants,
  copyFileSync,
  mkdirSync,
  renameSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'
import { getSettings } from '../repositories/settingsRepo'
import { createBackup } from './backup'
import { isNewerVersion } from '@shared/appVersion'
import type { AppUpdateInfo, AppUpdateProgress, AppUpdateStatus } from '@shared/types'
import { normalizePortalUrl, portalUrlProblem } from '@shared/portalUrl'
import {
  downloadAsset,
  fetchLatestRelease,
  localUpdateFileName,
  normalizeSha256Digest,
  pickAsset,
  type InstallKind
} from './selfUpdateCore'
import {
  clearPending,
  launchAction,
  pendingFileReady,
  pendingFileVerified,
  readPending,
  writePending,
  type PendingUpdate
} from './pendingUpdate'
import { tr } from '@shared/i18n'

/** How this copy of EduBoard was installed, which decides how it replaces itself; or
 * why it can't (running from source, from the Mac disk image…). */
function installKind(): { kind: InstallKind } | { reason: string } {
  if (!app.isPackaged)
    return { reason: tr('This copy runs from source code, not an installed app.') }
  if (process.platform === 'win32') {
    return { kind: process.env.PORTABLE_EXECUTABLE_FILE ? 'windows-portable' : 'windows-installer' }
  }
  if (process.platform === 'darwin') {
    const bundle = macAppBundle()
    if (!bundle) return { reason: tr('Couldn’t find the EduBoard app to replace.') }
    if (bundle.startsWith('/Volumes/')) {
      return {
        reason: tr('EduBoard is running from its disk image. Drag it into Applications first.')
      }
    }
    if (!isWritable(dirname(bundle))) {
      return {
        reason: tr('EduBoard can’t replace itself in {folder}.', { folder: dirname(bundle) })
      }
    }
    return { kind: 'mac' }
  }
  if (process.platform === 'linux') {
    const appImage = process.env.APPIMAGE
    if (!appImage) return { reason: tr('Only the AppImage version can update itself.') }
    if (!isWritable(dirname(appImage)))
      return {
        reason: tr('EduBoard can’t replace itself in {folder}.', { folder: dirname(appImage) })
      }
    return { kind: 'linux-appimage' }
  }
  return { reason: tr('Updating from inside EduBoard isn’t supported on this system.') }
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

/** Where a background download waits for the next launch: this computer's own profile,
 * never next to a portable copy's data, since it belongs to this computer's install. */
function pendingDir(): string {
  return join(app.getPath('userData'), 'pending-update')
}

/** Newest version the last check saw. */
let latestKnown: string | null = null

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
    latestKnown = release.version
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

/** A waiting download, if it's usable by this copy of EduBoard. */
function usablePending(): PendingUpdate | null {
  const where = installKind()
  const pending = readPending(pendingDir())
  if (!pending || !('kind' in where) || pending.kind !== where.kind) return null
  if (!isNewerVersion(pending.version, app.getVersion())) return null
  return pendingFileReady(pendingDir(), pending) ? pending : null
}

export function getAppUpdateStatus(): AppUpdateStatus {
  const current = app.getVersion()
  const where = installKind()
  const pending = usablePending()
  const latest = latestKnown ?? pending?.version ?? null
  return {
    current,
    latest,
    updateAvailable: Boolean(latest && isNewerVersion(latest, current)),
    readyVersion: pending?.version ?? null,
    downloading: progress.phase === 'downloading' ? progress.fraction : null,
    autoInstallFailed: Boolean(pending && pending.attempts >= 1),
    canInstall: 'kind' in where,
    cannotInstallReason: 'reason' in where ? where.reason : null
  }
}

/** Downloads `version`'s file for this computer into the pending folder and records it.
 * Downloads to a .part file first, so a download cut short is never mistaken for a
 * finished one. */
async function downloadToPending(kind: InstallKind): Promise<PendingUpdate> {
  const release = await fetchLatestRelease(portalUrl())
  latestKnown = release.version
  const asset = pickAsset(kind, process.arch, release.assets)
  if (!asset)
    throw new AppError('EB-3001', tr('The newest release has no download for this computer.'))
  const digest = normalizeSha256Digest(asset.digest)
  if (!digest)
    throw new AppError('EB-3007', tr('The update could not be verified. Download it again.'))
  const dir = pendingDir()
  clearPending(dir)
  mkdirSync(dir, { recursive: true })
  // The network-provided asset name is only used to select the download. On disk use a
  // fixed leaf name, so release metadata can never choose a path outside this folder.
  const fileName = localUpdateFileName(kind)
  const part = join(dir, `${fileName}.part`)
  progress = { phase: 'downloading', fraction: 0, error: null }
  await downloadAsset(asset, part, (fraction) => {
    progress = { phase: 'downloading', fraction, error: null }
  })
  renameSync(part, join(dir, fileName))
  const pending: PendingUpdate = {
    version: release.version,
    fileName,
    size: asset.size,
    digest,
    kind,
    attempts: 0,
    downloadedAt: new Date().toISOString()
  }
  writePending(dir, pending)
  progress = { phase: 'ready', fraction: 1, error: null }
  return pending
}

let backgroundRunning = false
let notifiedVersion: string | null = null

/** Checks for a newer EduBoard and, when automatic updates are on and this copy can
 * update itself, downloads it quietly. Never throws: a failed check just waits for the
 * next one. */
export async function checkForUpdateInBackground(): Promise<void> {
  if (backgroundRunning || progress.phase === 'downloading' || progress.phase === 'installing')
    return
  backgroundRunning = true
  try {
    const where = installKind()
    const release = await fetchLatestRelease(portalUrl())
    latestKnown = release.version
    if (!isNewerVersion(release.version, app.getVersion())) {
      clearPending(pendingDir())
      return
    }
    if (!('kind' in where) || !getSettings().autoUpdate) return
    const pending = usablePending()
    if (pending?.version === release.version) return
    const ready = await downloadToPending(where.kind)
    announceReady(ready.version)
  } catch (err) {
    // downloadToPending() moves `progress` on while this awaits; TypeScript can't see that.
    if ((progress as AppUpdateProgress).phase === 'downloading') {
      progress = { phase: 'idle', fraction: 0, error: null }
    }
    console.error('[eduboard] Background update check failed:', (err as Error).message)
  } finally {
    backgroundRunning = false
  }
}

/** A system notification, once per version, that the update installs next launch. The
 * window shows its own banner, icon and Settings badge from getAppUpdateStatus(). */
function announceReady(version: string): void {
  if (notifiedVersion === version || !Notification.isSupported()) return
  notifiedVersion = version
  const note = new Notification({
    title: tr('EduBoard {version} is ready', { version }),
    body: tr(
      'It installs the next time you open EduBoard. To install it now, restart from Settings.'
    )
  })
  note.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  note.show()
}

const FIRST_CHECK_DELAY_MS = 15_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

/** Starts the background checks: shortly after launch, then every few hours. */
export function startAutomaticUpdateChecks(): void {
  if (!app.isPackaged) return
  setTimeout(() => void checkForUpdateInBackground(), FIRST_CHECK_DELAY_MS)
  setInterval(() => void checkForUpdateInBackground(), CHECK_EVERY_MS).unref()
}

/**
 * Called at launch, after the launch backup and before the main window opens. If an
 * update downloaded earlier is waiting, installs it (a small window says so) and returns
 * true: the caller must not open the main window, because EduBoard is about to close and
 * reopen as the new version. If the install can't start after all, `openNormally` runs
 * so the teacher still gets EduBoard.
 */
export function installPendingUpdateOnLaunch(openNormally: () => void): boolean {
  const dir = pendingDir()
  const pending = readPending(dir)
  const where = installKind()
  const action = launchAction(pending, {
    currentVersion: app.getVersion(),
    kind: 'kind' in where ? where.kind : null,
    fileVerified: pending ? pendingFileVerified(dir, pending) : false,
    auto: getSettings().autoUpdate
  })
  if (action === 'clear') {
    // Also clears a corrupt/unreadable marker: readPending() deliberately returns null
    // for one, and leaving it behind would make every later launch rediscover the same junk.
    clearPending(dir)
    return false
  }
  if (action === 'wait' || !pending || !('kind' in where)) return false
  const kind = where.kind
  writePending(dir, { ...pending, attempts: pending.attempts + 1 })
  progress = { phase: 'installing', fraction: 1, error: null }
  const win = showUpdatingWindow(pending.version)
  // With password protection the main window is already open (it was the lock screen).
  const others = BrowserWindow.getAllWindows().filter((w) => w !== win)
  for (const w of others) w.hide()
  let started = false
  const start = (): void => {
    if (started) return
    started = true
    try {
      // On Linux this copies the new version into place, which blocks for a moment, so
      // it runs only once the window has drawn its message.
      startInstaller(kind, join(dir, localUpdateFileName(kind)), dir)
      setTimeout(() => app.quit(), 1500)
    } catch (err) {
      console.error('[eduboard] Installing the waiting update failed:', err)
      progress = { phase: 'idle', fraction: 0, error: null }
      if (!win.isDestroyed()) win.close()
      for (const w of others) if (!w.isDestroyed()) w.show()
      openNormally()
    }
  }
  win.once('ready-to-show', () => {
    win.show()
    setTimeout(start, 300)
  })
  // If the window never draws, install anyway.
  setTimeout(start, 4000)
  return true
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function showUpdatingWindow(version: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 150,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: tr('Updating EduBoard')
  })
  const heading = tr('Updating EduBoard to {version}…', {
    version: version.replace(/[^0-9A-Za-z.-]/g, '')
  })
  const note = tr('It will reopen by itself in a moment. Your data is kept.')
  const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(tr('Updating EduBoard'))}</title>
<body style="font:15px system-ui,sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;color:#1f2937;background:#fff">
<div><strong>${escapeHtml(heading)}</strong><br>
<span style="color:#6b7280">${escapeHtml(note)}</span></div></body>`
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  return win
}

/** "Update now" / "Restart and update" in Settings. Uses the waiting download when
 * there is one, otherwise downloads first. Backs up, then hands over to a small helper
 * that waits for EduBoard to close, puts the new version in place and reopens it. */
export async function installAppUpdate(): Promise<void> {
  if (progress.phase === 'installing') return
  const where = installKind()
  if (!('kind' in where)) throw new AppError('EB-3006', where.reason)
  try {
    createBackup()
    let pending = usablePending()
    if (pending && !pendingFileVerified(pendingDir(), pending)) {
      clearPending(pendingDir())
      pending = null
    }
    if (!pending || (latestKnown && isNewerVersion(latestKnown, pending.version))) {
      if (progress.phase === 'downloading')
        throw new AppError('EB-3005', tr('The update is still downloading.'))
      pending = await downloadToPending(where.kind)
    }
    if (!pendingFileVerified(pendingDir(), pending)) {
      clearPending(pendingDir())
      throw new AppError('EB-3007', tr('The update could not be verified. Download it again.'))
    }
    progress = { phase: 'installing', fraction: 1, error: null }
    // A teacher-started install resets the automatic-try count.
    writePending(pendingDir(), { ...pending, attempts: 0 })
    startInstaller(where.kind, join(pendingDir(), localUpdateFileName(where.kind)), pendingDir())
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
