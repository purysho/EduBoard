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
