import { app } from 'electron'
import { copyFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { resolveBackupsDir, resolveDbPath } from '../db/path'
import { closeDb, getSqlite } from '../db/client'
import type { BackupInfo } from '@shared/types'

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

  return { fileName, filePath, sizeBytes: stats.size, createdAt: new Date().toISOString() }
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
      return { fileName, filePath, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
