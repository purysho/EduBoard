import { app } from 'electron'
import { copyFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { basename, join } from 'path'
import Database from 'better-sqlite3'
import { resolveBackupsDir, resolveDbPath } from '../db/path'
import { closeDb, getSqlite } from '../db/client'
import { getSettings } from '../repositories/settingsRepo'
import type { BackupInfo, BackupPreview, ExtraBackupStatus } from '@shared/types'

/** Kept indefinitely by manual "Back up now" and pruning alike; only auto-backups
 * beyond this count are ever deleted, so a manual backup a teacher wants to keep
 * is safe as long as they don't create 30 more auto-backups after it. */
const MAX_AUTO_BACKUPS = 10
const AUTO_BACKUP_PREFIX = 'eduboard-autobackup-'

function timestampForFileName(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/** Flushes WAL to the main db file, then copies it into the backups folder and, when
 * one is set, the second backup folder. */
export function createBackup(): BackupInfo {
  const info = createBackupWithoutExtraCopy()
  copyToExtraFolder(info.filePath)
  return info
}

function createBackupWithoutExtraCopy(): BackupInfo {
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
    copyToExtraFolder(join(backupsDir, fileName))
  } catch (err) {
    console.error('Auto-backup on launch failed:', err)
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** EduBoard can stay open for days, so launch backups alone may be rare: check a few
 * times a day and take another automatic backup once the newest is a day old. */
export function startDailyAutoBackups(): void {
  setInterval(
    () => {
      const newestAuto = listBackups().find((b) => b.automatic)
      if (!newestAuto || Date.now() - Date.parse(newestAuto.createdAt) > DAY_MS) {
        createAutoBackupOnLaunch()
      }
    },
    3 * 60 * 60 * 1000
  ).unref()
}

/** A backup file's copy in the teacher's second folder (cloud-synced or a USB stick).
 * Never throws: an unplugged stick just means no copy this time, which the status
 * below then reports. */
export function copyToExtraFolder(
  backupFilePath: string,
  folder = getSettings().extraBackupFolder
): boolean {
  if (!folder) return false
  try {
    if (!existsSync(folder)) return false
    copyFileSync(backupFilePath, join(folder, basename(backupFilePath)))
    pruneAutoBackups(folder)
    return true
  } catch (err) {
    console.error('Copying the backup to the second folder failed:', err)
    return false
  }
}

const STALE_EXTRA_BACKUP_MS = 7 * DAY_MS

export function getExtraBackupStatus(folder = getSettings().extraBackupFolder): ExtraBackupStatus {
  if (!folder) return { folder, reachable: false, lastCopiedAt: null, needsAttention: true }
  let reachable = false
  let lastCopiedAt: string | null = null
  try {
    reachable = existsSync(folder)
    if (reachable) {
      const newest = readdirSync(folder)
        .filter((f) => f.startsWith('eduboard-') && f.endsWith('.db'))
        .map((f) => statSync(join(folder, f)).mtimeMs)
        .sort((a, b) => b - a)[0]
      if (newest) lastCopiedAt = new Date(newest).toISOString()
    }
  } catch {
    reachable = false
  }
  const needsAttention =
    !lastCopiedAt || Date.now() - Date.parse(lastCopiedAt) > STALE_EXTRA_BACKUP_MS
  return { folder, reachable, lastCopiedAt, needsAttention }
}

/** After choosing a folder: put a fresh backup there straight away. */
export function backUpToExtraFolderNow(folder: string): ExtraBackupStatus {
  const backup = createBackupWithoutExtraCopy()
  copyToExtraFolder(backup.filePath, folder)
  return getExtraBackupStatus(folder)
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
