// An update downloaded in the background waits in a folder until EduBoard next opens (or
// the teacher chooses to restart now). This file decides, without needing Electron, what
// a launch should do with it, so the rules can be tested.
import { createHash } from 'crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { isNewerVersion } from '@shared/appVersion'
import {
  localUpdateFileName,
  normalizeSha256Digest,
  type InstallKind
} from './selfUpdateCore'

export interface PendingUpdate {
  version: string
  fileName: string
  size: number
  digest: string
  kind: InstallKind
  /** Launches that tried to install it. One failed try stops automatic installs, so a
   * broken download can't close EduBoard every time it opens. */
  attempts: number
  downloadedAt: string
}

const MARKER = 'pending.json'
const INSTALL_KINDS = new Set<InstallKind>([
  'windows-installer',
  'windows-portable',
  'mac',
  'linux-appimage'
])

function isInstallKind(value: unknown): value is InstallKind {
  return typeof value === 'string' && INSTALL_KINDS.has(value as InstallKind)
}

function validPending(value: unknown): value is PendingUpdate {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<PendingUpdate>
  if (
    typeof p.version !== 'string' ||
    !isInstallKind(p.kind) ||
    typeof p.fileName !== 'string' ||
    p.fileName !== localUpdateFileName(p.kind) ||
    typeof p.size !== 'number' ||
    !Number.isFinite(p.size) ||
    p.size < 0 ||
    typeof p.digest !== 'string' ||
    normalizeSha256Digest(p.digest) !== p.digest ||
    typeof p.attempts !== 'number' ||
    !Number.isInteger(p.attempts) ||
    p.attempts < 0 ||
    typeof p.downloadedAt !== 'string'
  ) {
    return false
  }
  return true
}

export function readPending(dir: string): PendingUpdate | null {
  try {
    const p: unknown = JSON.parse(readFileSync(join(dir, MARKER), 'utf-8'))
    return validPending(p) ? p : null
  } catch {
    return null
  }
}

export function writePending(dir: string, pending: PendingUpdate): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, MARKER), JSON.stringify(pending, null, 2))
}

export function clearPending(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

/** The downloaded file is there and complete. */
export function pendingFileReady(dir: string, pending: PendingUpdate): boolean {
  if (pending.fileName !== localUpdateFileName(pending.kind)) return false
  const file = join(dir, localUpdateFileName(pending.kind))
  try {
    return existsSync(file) && (!pending.size || statSync(file).size === pending.size)
  } catch {
    return false
  }
}

function sha256File(file: string): string {
  const hash = createHash('sha256')
  const fd = openSync(file, 'r')
  const chunk = Buffer.allocUnsafe(1024 * 1024)
  try {
    while (true) {
      const read = readSync(fd, chunk, 0, chunk.length, null)
      if (!read) break
      hash.update(read === chunk.length ? chunk : chunk.subarray(0, read))
    }
  } finally {
    closeSync(fd)
  }
  return `sha256:${hash.digest('hex')}`
}

/** Re-checks the installer at the execution boundary, not only when it was downloaded. */
export function pendingFileVerified(dir: string, pending: PendingUpdate): boolean {
  if (!pendingFileReady(dir, pending)) return false
  try {
    return sha256File(join(dir, localUpdateFileName(pending.kind))) === pending.digest
  } catch {
    return false
  }
}

export type LaunchAction =
  /** Install it now, before the main window opens. */
  | 'install'
  /** Nothing waiting, or it's already installed / no longer usable: remove it. */
  | 'clear'
  /** Keep it, but let the teacher start the install (auto-install is off, or the last
   * automatic try didn't take). */
  | 'wait'

export function launchAction(
  pending: PendingUpdate | null,
  opts: { currentVersion: string; kind: InstallKind | null; fileVerified: boolean; auto: boolean }
): LaunchAction {
  if (!pending) return 'clear'
  if (!isNewerVersion(pending.version, opts.currentVersion)) return 'clear'
  if (!opts.fileVerified || pending.kind !== opts.kind) return 'clear'
  if (!opts.auto || pending.attempts >= 1) return 'wait'
  return 'install'
}
