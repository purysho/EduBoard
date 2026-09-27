// The anonymous "still using it" ping (Settings → Help improve EduBoard; off unless the
// teacher turns it on). What it contains is fixed here, and Settings shows it exactly
// as sent: a random id this computer made up, the version, the operating system and
// language, and rough sizes as bands. Never names, a school, or anything a student wrote.

export interface UsagePing {
  /** Random, made when the ping is turned on and forgotten when it's turned off. */
  id: string
  version: string
  os: 'windows' | 'mac' | 'linux'
  language: 'en' | 'zh'
  classes: '0' | '1-2' | '3-5' | '6+'
  students: '0' | '1-30' | '31-100' | '101+'
  /** Whether a Portal is set up (not which one). */
  portal: boolean
}

/** Where pings go: the EduBoard project's own server. */
export const USAGE_PING_URL = 'https://portal.edu-board.com/api/usage/ping'

/** At most one ping a week. */
export const USAGE_PING_EVERY_MS = 7 * 24 * 60 * 60 * 1000

export const classBand = (n: number): UsagePing['classes'] =>
  n <= 0 ? '0' : n <= 2 ? '1-2' : n <= 5 ? '3-5' : '6+'

export const studentBand = (n: number): UsagePing['students'] =>
  n <= 0 ? '0' : n <= 30 ? '1-30' : n <= 100 ? '31-100' : '101+'

export const osName = (platform: string): UsagePing['os'] =>
  platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux'

/** Whether a ping is due: turned on, and none sent in the last week. */
export function usagePingDue(on: boolean, lastSentIso: string | null, now: Date): boolean {
  if (!on) return false
  if (!lastSentIso) return true
  const last = Date.parse(lastSentIso)
  return !Number.isFinite(last) || now.getTime() - last >= USAGE_PING_EVERY_MS
}
