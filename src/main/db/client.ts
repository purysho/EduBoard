import { AppError } from '@shared/errorCodes'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { runMigrations } from './migrations'
import * as schema from './schema'
import { resolveDbPath } from './path'

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>

let sqliteInstance: Database.Database | null = null
let dbInstance: AppDatabase | null = null
let dbPathOverride: string | null = null
/** The key the open database was unlocked with (hex), kept for backups and re-keying. */
let dbKey: string | null = null

/**
 * Lets tests point the singleton at a throwaway file instead of the Electron-resolved
 * portable/userData path (calling resolveDbPath() outside a real Electron process would
 * throw, since it reads app.getPath()). Must be called before the first getDb()/initDb().
 */
export function setDbPathForTesting(path: string): void {
  dbPathOverride = path
}

export function currentDbPath(): string {
  return dbPathOverride ?? resolveDbPath()
}

/** Applies an encryption key to a just-opened connection. Keys are generated hex, so
 * the value can't break out of the quoted pragma. */
export function applyKey(sqlite: Database.Database, key: string): void {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new AppError('EB-5001', 'Invalid database key')
  sqlite.pragma(`key='${key}'`)
}

/** Opens the database. An encrypted one needs its key: without the right one SQLite
 * reports "file is not a database" on the first read, which this surfaces at once. */
export function initDb(key: string | null = null): AppDatabase {
  if (dbInstance) return dbInstance

  const dbPath = currentDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  if (key) applyKey(sqlite, key)
  try {
    sqlite.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch (err) {
    sqlite.close()
    throw err
  }
  dbKey = key
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  runMigrations(sqlite)

  sqliteInstance = sqlite
  dbInstance = drizzle(sqlite, { schema })
  return dbInstance
}

export function getDb(): AppDatabase {
  return dbInstance ?? initDb()
}

export function getSqlite(): Database.Database {
  if (!sqliteInstance) initDb()
  return sqliteInstance!
}

export function closeDb(): void {
  sqliteInstance?.close()
  sqliteInstance = null
  dbInstance = null
  dbKey = null
}

export function isDbOpen(): boolean {
  return dbInstance !== null
}

export function currentDbKey(): string | null {
  return dbKey
}

/** Encrypts the open database with `key`, re-keys it, or with null decrypts it, in
 * place. SQLite can't change the key of a database in WAL mode, so the log is folded
 * in and the database leaves WAL mode for the moment it takes. */
export function setDatabaseKey(key: string | null): void {
  if (key !== null && !/^[0-9a-f]{64}$/.test(key))
    throw new AppError('EB-5001', 'Invalid database key')
  const sqlite = getSqlite()
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
  sqlite.pragma('journal_mode = DELETE')
  try {
    sqlite.pragma(`rekey='${key ?? ''}'`)
    dbKey = key
  } finally {
    sqlite.pragma('journal_mode = WAL')
  }
}
