// Sends the weekly anonymous ping (see shared/usagePing.ts) when the teacher has turned
// it on. Checked at startup and every few hours; a failed send just tries again later.
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { listClasses } from '../repositories/classes'
import { listStudents } from '../repositories/students'
import { getSettings, getStoredValue, setStoredValue } from '../repositories/settingsRepo'
import { uiLanguage } from '@shared/i18n'
import {
  USAGE_PING_URL,
  classBand,
  osName,
  studentBand,
  usagePingDue,
  type UsagePing
} from '@shared/usagePing'

const ID_KEY = 'usagePing.id'
const LAST_KEY = 'usagePing.lastSentAt'

/** The ping as it would be sent now. The id is blank until the ping is turned on. */
export function usagePingPreview(): UsagePing {
  const settings = getSettings()
  return {
    id: getStoredValue<string>(ID_KEY) ?? '',
    version: app.getVersion(),
    os: osName(process.platform),
    language: uiLanguage() === 'zh' ? 'zh' : 'en',
    classes: classBand(listClasses(false).length),
    students: studentBand(listStudents(false).length),
    portal: !!settings.portalUrl
  }
}

/** Called when the setting changes: turning it on makes a new random id; turning it
 * off forgets the id, so turning it on again later starts afresh. */
export function usagePingSettingChanged(on: boolean): void {
  if (on && !getStoredValue<string>(ID_KEY)) setStoredValue(ID_KEY, randomUUID())
  if (!on) {
    setStoredValue(ID_KEY, null)
    setStoredValue(LAST_KEY, null)
  }
  void sendUsagePingIfDue()
}

export async function sendUsagePingIfDue(
  now = new Date(),
  doFetch: typeof fetch = fetch
): Promise<boolean> {
  try {
    const on = getSettings().usagePing === true
    if (!usagePingDue(on, getStoredValue<string>(LAST_KEY), now)) return false
    const ping = usagePingPreview()
    if (!ping.id) return false
    const res = await doFetch(USAGE_PING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ping),
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) return false
    setStoredValue(LAST_KEY, now.toISOString())
    return true
  } catch {
    // Offline, locked, or the server is down: try again at the next check.
    return false
  }
}

let timer: NodeJS.Timeout | null = null

export function startUsagePings(): void {
  void sendUsagePingIfDue()
  if (!timer) timer = setInterval(() => void sendUsagePingIfDue(), 6 * 60 * 60 * 1000)
}
