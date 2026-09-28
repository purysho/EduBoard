import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyToExtraFolder, getExtraBackupStatus, pruneAutoBackups } from '../backup'

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

  it('keeps a backup from each of the last days, not just the last few launches', () => {
    // Five launches a day for twelve days: 60 backups.
    const day = 24 * 60 * 60 * 1000
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    for (let d = 0; d < 12; d++) {
      for (let l = 0; l < 5; l++) {
        writeBackup(
          `eduboard-autobackup-d${d}-l${l}.db`,
          new Date(noon.getTime() - d * day - l * 60_000)
        )
      }
    }
    pruneAutoBackups(dir)
    const kept = readdirSync(dir)
    expect(kept.length).toBe(10)
    // Today's three newest launches…
    for (const l of [0, 1, 2]) expect(kept).toContain(`eduboard-autobackup-d0-l${l}.db`)
    // …and the newest backup of each of the seven days before.
    for (let d = 1; d <= 7; d++) expect(kept).toContain(`eduboard-autobackup-d${d}-l0.db`)
  })

  it('does nothing when at or under the cap', () => {
    for (let i = 0; i < 5; i++) {
      writeBackup(`eduboard-autobackup-${i}.db`, new Date(Date.now() - i * 1000))
    }
    pruneAutoBackups(dir)
    expect(readdirSync(dir).length).toBe(5)
  })
})

describe('second backup folder', () => {
  it('copies a backup there, keeping its name', () => {
    const extra = mkdtempSync(join(tmpdir(), 'eduboard-extra-'))
    try {
      writeBackup('eduboard-backup-2026.db', new Date())
      expect(copyToExtraFolder(join(dir, 'eduboard-backup-2026.db'), extra)).toBe(true)
      expect(existsSync(join(extra, 'eduboard-backup-2026.db'))).toBe(true)
      const status = getExtraBackupStatus(extra)
      expect(status.reachable).toBe(true)
      expect(status.lastCopiedAt).not.toBeNull()
      expect(status.needsAttention).toBe(false)
    } finally {
      rmSync(extra, { recursive: true, force: true })
    }
  })

  it('skips quietly when the folder is gone (an unplugged USB stick)', () => {
    writeBackup('eduboard-backup-2026.db', new Date())
    const missing = join(dir, 'no-such-stick')
    expect(copyToExtraFolder(join(dir, 'eduboard-backup-2026.db'), missing)).toBe(false)
    expect(getExtraBackupStatus(missing)).toMatchObject({ reachable: false, needsAttention: true })
  })

  it('asks for attention when there is no second folder, or its copy is over a week old', () => {
    expect(getExtraBackupStatus('').needsAttention).toBe(true)
    writeBackup('eduboard-autobackup-old.db', new Date(Date.now() - 8 * 86_400_000))
    expect(getExtraBackupStatus(dir).needsAttention).toBe(true)
  })
})
