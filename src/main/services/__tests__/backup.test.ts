import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pruneAutoBackups } from '../backup'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-backup-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeBackup(name: string, mtime: Date): void {
  const path = join(dir, name)
  writeFileSync(path, 'x')
  utimesSync(path, mtime, mtime)
}

describe('pruneAutoBackups', () => {
  it('deletes the oldest-by-mtime files beyond the cap, not the lexicographically first', () => {
    // Deliberately give the *newest* real auto-backup a filename that sorts first
    // alphabetically among auto-backups ("0000-newest" < "mid-*") — a naive name-sort
    // would delete it as if it were oldest. Real mtime-based pruning must keep it and
    // delete the genuinely old one instead.
    const now = Date.now()
    for (let i = 0; i < 10; i++) {
      writeBackup(`eduboard-autobackup-mid-${i}.db`, new Date(now - (10 - i) * 60_000))
    }
    writeBackup('eduboard-autobackup-oldest.db', new Date(now - 3_600_000))
    writeBackup('eduboard-autobackup-0000-newest.db', new Date(now))
    // Not a prefix match — this manual backup must survive regardless.
    writeBackup('eduboard-backup-manual.db', new Date(now - 7_200_000))

    pruneAutoBackups(dir)

    const remaining = new Set(readdirSync(dir))
    expect(remaining.has('eduboard-autobackup-oldest.db')).toBe(false)
    expect(remaining.has('eduboard-autobackup-0000-newest.db')).toBe(true)
    expect(remaining.has('eduboard-backup-manual.db')).toBe(true)
    // 10 mid + 1 oldest + 1 newest = 12 auto-backups, capped at 10 → 2 pruned.
    expect([...remaining].filter((f) => f.startsWith('eduboard-autobackup-')).length).toBe(10)
  })

  it('does nothing when at or under the cap', () => {
    for (let i = 0; i < 5; i++) {
      writeBackup(`eduboard-autobackup-${i}.db`, new Date(Date.now() - i * 1000))
    }
    pruneAutoBackups(dir)
    expect(readdirSync(dir).length).toBe(5)
  })
})
