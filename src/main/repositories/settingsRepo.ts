import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { settings } from '../db/schema'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@shared/types'

const SETTINGS_KEY = 'app_settings'

export function getSettings(): AppSettings {
  const row = getDb().select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get() as
    { key: string; value: string } | undefined
  if (!row) return DEFAULT_APP_SETTINGS
  try {
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(row.value) }
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}

/** Small bits of app state that aren't settings (the teacher never edits them), kept in
 * the same key/value table under their own keys. */
export function getStoredValue<T>(key: string): T | null {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get() as
    { key: string; value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

export function setStoredValue(key: string, value: unknown): void {
  const db = getDb()
  const json = JSON.stringify(value)
  if (db.select().from(settings).where(eq(settings.key, key)).get()) {
    db.update(settings).set({ value: json }).where(eq(settings.key, key)).run()
  } else {
    db.insert(settings).values({ key, value: json }).run()
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  const db = getDb()
  const value = JSON.stringify(next)
  const existing = db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get()
  if (existing) {
    db.update(settings).set({ value }).where(eq(settings.key, SETTINGS_KEY)).run()
  } else {
    db.insert(settings).values({ key: SETTINGS_KEY, value }).run()
  }
  return next
}
