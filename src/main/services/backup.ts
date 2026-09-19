import { app } from 'electron'
import { copyFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { resolveBackupsDir, resolveDbPath } from '../db/path'
import { closeDb, getSqlite } from '../db/client'
import type { BackupInfo, BackupPreview } from '@shared/types'

/** Kept indefinitely by manual "Back up now" and pruning alike; only auto-backups
 * beyond this count are ever deleted, so a manual backup a teacher wants to keep
 * is safe as long as they don't create 30 more auto-backups after it. */
const MAX_AUTO_BACKUPS = 10
const AUTO_BACKUP_PREFIX = 'eduboard-autobackup-'

function timestampForFileName(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/** Flushes WAL to the main db file, then copies it into the backups folder. */
export function createBackup(): BackupInfo {
  getSqlite().pragma('wal_checkpoint(TRUNCATE)')

  const dbPath = resolveDbPath()
  const backupsDir = resolveBackupsDir()
  const fileName = `eduboard-backup-${timestampForFileName()}.db`
  const filePath = join(backupsDir, fileName)

  copyFileSync(dbPath, filePath)
  const stats = statSync(filePath)

  return {
    fileName,
    filePath,
    sizeBytes: stats.size,
    createdAt: new Date().toISOString(),
    automatic: false
  }
}

/** Runs once per app launch, right after the DB is ready. Silently backs up the
 * current database before the user can touch it — a bad import, a fumbled Restore,
 * or a corrupted USB stick can then always be undone. Never throws: a failed
 * auto-backup should not block the app from opening. */
export function createAutoBackupOnLaunch(): void {
  try {
    const dbPath = resolveDbPath()
    if (!existsSync(dbPath)) return // first-ever launch, nothing to back up yet

    getSqlite().pragma('wal_checkpoint(TRUNCATE)')

    const backupsDir = resolveBackupsDir()
    const fileName = `${AUTO_BACKUP_PREFIX}${timestampForFileName()}.db`
    copyFileSync(dbPath, join(backupsDir, fileName))

    pruneAutoBackups(backupsDir)
  } catch (err) {
    console.error('Auto-backup on launch failed:', err)
  }
}

export function pruneAutoBackups(backupsDir: string): void {
  // Sort by actual file mtime, not the timestamp embedded in the filename — the
  // filename format is just this file's convention, and if it ever changes, a
  // lexicographic sort of names could silently delete the newest backups instead of
  // the oldest ones. mtime is what "oldest" actually means here regardless of naming.
  const autoBackups = readdirSync(backupsDir)
    .filter((f) => f.startsWith(AUTO_BACKUP_PREFIX) && f.endsWith('.db'))
    .map((f) => ({ name: f, mtimeMs: statSync(join(backupsDir, f)).mtimeMs }))
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
  const excess = autoBackups.length - MAX_AUTO_BACKUPS
  for (let i = 0; i < excess; i++) {
    unlinkSync(join(backupsDir, autoBackups[i].name))
  }
}

/** Opens a backup file read-only (never touches the live DB connection) and reports
 * what's in it, alongside the live database's current counts, so a teacher can see
 * what they're about to overwrite before confirming a restore. */
export function previewBackup(backupFilePath: string): BackupPreview {
  const backupCounts = countRows(backupFilePath)
  const liveCounts = countRows(resolveDbPath())
  return { backup: backupCounts, current: liveCounts }
}

function countRows(dbPath: string): BackupPreview['backup'] {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const count = (table: string): number =>
      (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c
    return {
      students: count('students'),
      classes: count('classes'),
      scores: count('scores'),
      attendanceRecords: count('attendance_records')
    }
  } finally {
    db.close()
  }
}

/** Overwrites the live database with a backup file, then relaunches the app so every
 * window picks up the restored data with a clean connection instead of hot-swapping. */
export function restoreBackup(backupFilePath: string): void {
  closeDb()
  copyFileSync(backupFilePath, resolveDbPath())
  app.relaunch()
  app.exit(0)
}

export function listBackups(): BackupInfo[] {
  const backupsDir = resolveBackupsDir()
  return readdirSync(backupsDir)
    .filter((f) => f.endsWith('.db'))
    .map((fileName) => {
      const filePath = join(backupsDir, fileName)
      const stats = statSync(filePath)
      return {
        fileName,
        filePath,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
        automatic: fileName.startsWith(AUTO_BACKUP_PREFIX)
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
