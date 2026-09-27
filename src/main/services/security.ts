// Password protection: the database is encrypted, EduBoard asks for the password when it
// opens, and it locks itself after a while with no one at the computer. Locking hides the
// app behind the password screen and refuses the window's requests; the database stays
// open underneath, so an exit ticket running for the class and the daily backup carry on.
import { powerMonitor } from 'electron'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import {
  closeDb,
  currentDbKey,
  currentDbPath,
  initDb,
  isDbOpen,
  setDatabaseKey
} from '../db/client'
import { keyFilePathFor } from '../db/path'
import {
  createKeyFile,
  MIN_PASSWORD_LENGTH,
  newDatabaseKey,
  newRecoveryKey,
  parseKeyFile,
  sameKey,
  unlockKeyFile,
  withNewPassword,
  type KeyFile
} from '../security/keyFile'
import { getSettings } from '../repositories/settingsRepo'
import type { SecurityStatus } from '@shared/types'
import { tr } from '@shared/i18n'

export function keyFilePath(): string {
  return keyFilePathFor(currentDbPath())
}

export function isProtected(): boolean {
  return existsSync(keyFilePath())
}

function readKeyFile(): KeyFile {
  const file = parseKeyFile(readFileSync(keyFilePath(), 'utf-8'))
  if (!file) throw new Error(tr('EduBoard’s key file is damaged. Restore a backup to continue.'))
  return file
}

/** Written to a temporary name first, so a crash mid-write never leaves half a key file. */
function writeKeyFile(file: KeyFile): void {
  const path = keyFilePath()
  writeFileSync(`${path}.tmp`, JSON.stringify(file, null, 2))
  renameSync(`${path}.tmp`, path)
}

let uiLocked = false
let failedTries = 0
let waitUntil = 0
let onFirstUnlock: (() => void) | null = null

/** The window is behind the lock screen: either EduBoard just opened and the database
 * is still encrypted on disk, or it locked itself / was locked. */
export function isLocked(): boolean {
  return isProtected() && (!isDbOpen() || uiLocked)
}

export function getSecurityStatus(): SecurityStatus {
  const prot = isProtected()
  return {
    protected: prot,
    locked: prot && (!isDbOpen() || uiLocked),
    retryInSeconds: Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000)),
    autoLockMinutes: isDbOpen() ? getSettings().autoLockMinutes : null
  }
}

/** Runs once, the first time the database is unlocked after launch (the rest of
 * startup that needs the database: launch backup, waiting update, background checks). */
export function whenFirstUnlocked(callback: () => void): void {
  onFirstUnlock = callback
}

/** Tries the password or recovery key. After five wrong tries, each further try waits
 * thirty seconds, which makes guessing through the lock screen impractical. */
export function unlock(secret: string): { ok: boolean; retryInSeconds: number } {
  const now = Date.now()
  if (now < waitUntil) return { ok: false, retryInSeconds: Math.ceil((waitUntil - now) / 1000) }
  const key = unlockKeyFile(readKeyFile(), secret)
  if (!key || (isDbOpen() && !sameKey(key, currentDbKey() ?? ''))) {
    failedTries += 1
    if (failedTries >= 5) waitUntil = now + 30_000
    return { ok: false, retryInSeconds: failedTries >= 5 ? 30 : 0 }
  }
  failedTries = 0
  waitUntil = 0
  uiLocked = false
  if (!isDbOpen()) {
    initDb(key)
    const cb = onFirstUnlock
    onFirstUnlock = null
    cb?.()
  }
  return { ok: true, retryInSeconds: 0 }
}

export function lockNow(): void {
  if (isProtected() && isDbOpen()) uiLocked = true
}

function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(tr('Use at least {n} characters.', { n: MIN_PASSWORD_LENGTH }))
  }
}

/** Turns protection on: encrypts the open database with a new random key and writes
 * the key file. Returns the recovery key, which is shown once and never stored. */
export function enableProtection(password: string): { recoveryKey: string } {
  if (isProtected()) throw new Error(tr('Password protection is already on.'))
  checkPassword(password)
  const dbKey = newDatabaseKey()
  const recoveryKey = newRecoveryKey()
  setDatabaseKey(dbKey)
  try {
    writeKeyFile(createKeyFile(dbKey, password, recoveryKey))
  } catch (err) {
    // Without the key file the encrypted database could never be opened again.
    setDatabaseKey(null)
    throw err
  }
  return { recoveryKey }
}

export function changePassword(current: string, next: string): void {
  checkPassword(next)
  const file = readKeyFile()
  const key = unlockKeyFile(file, current)
  if (!key) throw new Error(tr('That isn’t your current password or recovery key.'))
  writeKeyFile(withNewPassword(file, key, next))
}

/** Turns protection off: decrypts the database and removes the key file. */
export function disableProtection(password: string): void {
  if (!unlockKeyFile(readKeyFile(), password)) {
    throw new Error(tr('That isn’t your current password or recovery key.'))
  }
  setDatabaseKey(null)
  rmSync(keyFilePath(), { force: true })
  uiLocked = false
}

/** Locks after the computer has had no keyboard or mouse use for the teacher's chosen
 * number of minutes, and whenever the computer itself locks or sleeps. */
export function startAutoLock(): void {
  const lockIfProtected = (): void => lockNow()
  powerMonitor.on('lock-screen', lockIfProtected)
  powerMonitor.on('suspend', lockIfProtected)
  setInterval(() => {
    if (!isProtected() || !isDbOpen() || uiLocked) return
    const minutes = getSettings().autoLockMinutes
    if (minutes > 0 && powerMonitor.getSystemIdleTime() >= minutes * 60) lockNow()
  }, 20_000).unref()
}

/** For tests: forget lock state between cases. */
export function resetSecurityStateForTesting(): void {
  uiLocked = false
  failedTries = 0
  waitUntil = 0
  onFirstUnlock = null
  closeDb()
}
