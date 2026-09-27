// An update downloaded in the background waits in a folder until EduBoard next opens (or
// the teacher chooses to restart now). This file decides, without needing Electron, what
// a launch should do with it, so the rules can be tested.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { isNewerVersion } from '@shared/appVersion'
import type { InstallKind } from './selfUpdateCore'

export interface PendingUpdate {
  version: string
  fileName: string
  size: number
  kind: InstallKind
  /** Launches that tried to install it. One failed try stops automatic installs, so a
   * broken download can't close EduBoard every time it opens. */
  attempts: number
  downloadedAt: string
}

const MARKER = 'pending.json'

export function readPending(dir: string): PendingUpdate | null {
  try {
    const p = JSON.parse(readFileSync(join(dir, MARKER), 'utf-8')) as PendingUpdate
    return typeof p.version === 'string' && typeof p.fileName === 'string' ? p : null
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
  const file = join(dir, pending.fileName)
  try {
    return existsSync(file) && (!pending.size || statSync(file).size === pending.size)
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
  opts: { currentVersion: string; kind: InstallKind | null; fileReady: boolean; auto: boolean }
): LaunchAction {
  if (!pending) return 'clear'
  if (!isNewerVersion(pending.version, opts.currentVersion)) return 'clear'
  if (!opts.fileReady || pending.kind !== opts.kind) return 'clear'
  if (!opts.auto || pending.attempts >= 1) return 'wait'
  return 'install'
}
