import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { hostname } from 'os'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { settings } from '../db/schema'
import type { DeviceSyncStatus } from '@shared/types'

const SETTINGS_KEY = 'device_sync'

/** A random id persisted in the OS per-user profile (never in the portable database
 * itself, so it stays tied to this one machine even when the DB travels on a USB
 * stick). Used to tell "this computer" apart from "some other computer" for the
 * last-writer check below. */
function getOrCreateDeviceId(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = join(dir, 'device-id.txt')
  try {
    const existing = readFileSync(filePath, 'utf-8').trim()
    if (existing) return existing
  } catch {
    // fall through to create one
  }
  const id = randomUUID()
  writeFileSync(filePath, id)
  return id
}

interface StoredRecord {
  deviceId: string
  deviceLabel: string
  openedAt: string
}

function readRecord(): StoredRecord | null {
  const row = getDb().select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get() as
    { key: string; value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as StoredRecord
  } catch {
    return null
  }
}

function writeRecord(record: StoredRecord): void {
  const db = getDb()
  const value = JSON.stringify(record)
  const existing = db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get()
  if (existing) {
    db.update(settings).set({ value }).where(eq(settings.key, SETTINGS_KEY)).run()
  } else {
    db.insert(settings).values({ key: SETTINGS_KEY, value }).run()
  }
}

let cachedStatus: DeviceSyncStatus = { openedOnAnotherDevice: false }

/** Called once on launch (before any window opens). Compares the database's
 * last-opened-by record against this machine's device id — if they differ, this
 * database was most recently opened on a different computer, which is the classic
 * "USB stick shuttled between two computers without syncing" risk. Always records
 * this device as the new last-opener, so the warning only fires once per actual
 * handoff, not on every subsequent launch here. The result is cached so the renderer
 * can fetch it (possibly more than once, e.g. on a hot reload) without re-running
 * the write. */
export function checkAndRecordDeviceSync(): void {
  try {
    const thisDeviceId = getOrCreateDeviceId()
    const thisDeviceLabel = hostname() || 'This computer'
    const previous = readRecord()

    writeRecord({
      deviceId: thisDeviceId,
      deviceLabel: thisDeviceLabel,
      openedAt: new Date().toISOString()
    })

    cachedStatus =
      !previous || previous.deviceId === thisDeviceId
        ? { openedOnAnotherDevice: false }
        : {
            openedOnAnotherDevice: true,
            previousDeviceLabel: previous.deviceLabel,
            previousOpenedAt: previous.openedAt
          }
  } catch (err) {
    console.error('Device sync check failed:', err)
  }
}

export function getDeviceSyncStatus(): DeviceSyncStatus {
  return cachedStatus
}
