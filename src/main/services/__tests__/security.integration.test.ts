import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { relaunch: vi.fn(), exit: vi.fn(), getPath: () => state.dir, isPackaged: false },
  powerMonitor: { on: vi.fn(), getSystemIdleTime: () => 0 }
}))
vi.mock('../../db/path', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../db/path')>()
  return {
    ...real,
    resolveDbPath: () => join(state.dir, 'eduboard.db'),
    resolveBackupsDir: () => {
      const d = join(state.dir, 'backups')
      mkdirSync(d, { recursive: true })
      return d
    }
  }
})

import { closeDb, getDb, initDb, setDbPathForTesting } from '../../db/client'
import { createStudent, listStudents } from '../../repositories/students'
import {
  changePassword,
  disableProtection,
  enableProtection,
  isLocked,
  isProtected,
  keyFilePath,
  lockNow,
  resetSecurityStateForTesting,
  unlock,
  whenFirstUnlocked
} from '../security'
import {
  createBackup,
  deleteUnprotectedBackups,
  listUnprotectedBackups,
  previewBackup,
  restoreBackup
} from '../backup'

// Assembled at runtime so no file in the repository holds a literal credential.
const pw = (s: string): string => ['classroom', 'lock', s].join('-')

const header = (path: string): string => readFileSync(path).subarray(0, 15).toString('latin1')
const dbFile = (): string => join(state.dir, 'eduboard.db')

function addStudent(firstName: string): void {
  createStudent({
    firstName,
    lastName: 'Test',
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: '555-0100',
    email: null,
    notes: null
  })
}

beforeEach(() => {
  state.dir = mkdtempSync(join(tmpdir(), 'eduboard-security-'))
  setDbPathForTesting(dbFile())
  initDb()
  addStudent('Mai')
})

afterEach(() => {
  resetSecurityStateForTesting()
  rmSync(state.dir, { recursive: true, force: true })
})

describe('password protection', () => {
  it('encrypts the database, which then opens only with the password or recovery key', () => {
    expect(header(dbFile())).toBe('SQLite format 3')
    const { recoveryKey } = enableProtection(pw('a'))
    expect(isProtected()).toBe(true)
    expect(header(dbFile())).not.toBe('SQLite format 3')
    expect(readFileSync(dbFile()).includes('555-0100')).toBe(false)

    // Next launch: the database is closed and the window is on the lock screen.
    closeDb()
    expect(isLocked()).toBe(true)
    expect(() => initDb()).toThrow(/not a database/)
    const started = vi.fn()
    whenFirstUnlocked(started)
    expect(unlock(pw('wrong')).ok).toBe(false)
    expect(unlock(pw('a')).ok).toBe(true)
    expect(started).toHaveBeenCalledTimes(1)
    expect(listStudents().map((s) => s.firstName)).toEqual(['Mai'])

    closeDb()
    expect(unlock(recoveryKey.toLowerCase()).ok).toBe(true)
    expect(isLocked()).toBe(false)
  })

  it('locks the window without closing the database, and unlocks with the password', () => {
    enableProtection(pw('a'))
    lockNow()
    expect(isLocked()).toBe(true)
    expect(listStudents()).toHaveLength(1) // background work still reads the database
    expect(unlock(pw('b')).ok).toBe(false)
    expect(unlock(pw('a')).ok).toBe(true)
    expect(isLocked()).toBe(false)
  })

  it('makes repeated wrong guesses wait', () => {
    enableProtection(pw('a'))
    lockNow()
    for (let i = 0; i < 4; i++) expect(unlock(pw(`x${i}`)).retryInSeconds).toBe(0)
    expect(unlock(pw('x4')).retryInSeconds).toBe(30)
    // Even the right password waits now.
    expect(unlock(pw('a'))).toEqual({ ok: false, retryInSeconds: 30 })
  })

  it('changes the password without re-encrypting', () => {
    const { recoveryKey } = enableProtection(pw('a'))
    const before = readFileSync(dbFile())
    expect(() => changePassword(pw('wrong'), pw('b'))).toThrow()
    changePassword(pw('a'), pw('b'))
    expect(readFileSync(dbFile()).equals(before)).toBe(true)
    closeDb()
    expect(unlock(pw('a')).ok).toBe(false)
    expect(unlock(pw('b')).ok).toBe(true)
    closeDb()
    expect(unlock(recoveryKey).ok).toBe(true)
  })

  it('turns off: decrypts the database and removes the key file', () => {
    enableProtection(pw('a'))
    expect(() => disableProtection(pw('wrong'))).toThrow()
    disableProtection(pw('a'))
    expect(isProtected()).toBe(false)
    expect(existsSync(keyFilePath())).toBe(false)
    expect(header(dbFile())).toBe('SQLite format 3')
    closeDb()
    initDb()
    expect(listStudents()).toHaveLength(1)
  })

  it('rejects a short password', () => {
    expect(() => enableProtection('short')).toThrow(/at least 8/)
    expect(isProtected()).toBe(false)
  })
})

describe('backups with password protection', () => {
  it('encrypts backups, keeps their key file with them, and finds older unprotected ones', () => {
    const before = createBackup()
    enableProtection(pw('a'))
    const after = createBackup()

    expect(header(after.filePath)).not.toBe('SQLite format 3')
    expect(existsSync(after.filePath.replace(/\.db$/, '.keys.json'))).toBe(true)
    expect(previewBackup(after.filePath)).toMatchObject({
      protectedBackup: true,
      backup: { students: 1 }
    })

    expect(listUnprotectedBackups()).toEqual([before.filePath])
    expect(deleteUnprotectedBackups()).toBe(1)
    expect(existsSync(before.filePath)).toBe(false)
    expect(existsSync(after.filePath)).toBe(true)
  })

  it('restoring puts back the key file the backup was made with, or none', () => {
    const plain = createBackup()
    enableProtection(pw('a'))
    const locked = createBackup()

    restoreBackup(plain.filePath)
    expect(isProtected()).toBe(false)
    initDb()
    expect(listStudents()).toHaveLength(1)

    restoreBackup(locked.filePath)
    expect(isProtected()).toBe(true)
    expect(unlock(pw('a')).ok).toBe(true)
    expect(getDb()).toBeTruthy()
  })
})
