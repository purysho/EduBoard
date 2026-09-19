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

/**
 * Lets tests point the singleton at a throwaway file instead of the Electron-resolved
 * portable/userData path (calling resolveDbPath() outside a real Electron process would
 * throw, since it reads app.getPath()). Must be called before the first getDb()/initDb().
 */
export function setDbPathForTesting(path: string): void {
  dbPathOverride = path
}

export function initDb(): AppDatabase {
  if (dbInstance) return dbInstance

  const dbPath = dbPathOverride ?? resolveDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
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
}
