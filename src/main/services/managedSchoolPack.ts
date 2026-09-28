// A school pack installed for everyone on a computer, for a school that sets up EduBoard
// for all its teachers (docs/SCHOOL_DEPLOYMENT.md). The school's IT copies the pack to a
// machine-wide folder; every teacher on that computer then gets the school's name for the
// app, its logo, colour and stylesheet at every start, locked in Settings. The rest of the
// pack (grading scale, codes, terms, comment bank…) is applied once for each version of
// the file, so a teacher can still adjust those afterwards.
import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { parseSchoolPack, planSchoolPack } from '@shared/schoolPack'
import { BRANDING_KEYS, type BrandingKey, type ManagedBranding } from '@shared/branding'
import type { AppSettings } from '@shared/types'
import {
  getSettings,
  getStoredValue,
  setStoredValue,
  updateSettings
} from '../repositories/settingsRepo'
import { createTerm, listTerms } from '../repositories/terms'
import { isSampleSchool } from '../db/path'
import { logError } from './errorLog'

const APPLIED_KEY = 'managed_school_pack_applied'

/** Where a computer-wide pack is looked for, first match wins. Next to the program comes
 * last, for a portable copy on a USB stick. EDUBOARD_SCHOOL_PACK names a file directly. */
export function managedPackCandidates(): string[] {
  const list: string[] = []
  if (process.env.EDUBOARD_SCHOOL_PACK) list.push(process.env.EDUBOARD_SCHOOL_PACK)
  if (process.platform === 'win32') {
    list.push(join(process.env.ProgramData || 'C:\\ProgramData', 'EduBoard', 'school-pack.json'))
  } else if (process.platform === 'darwin') {
    list.push('/Library/Application Support/EduBoard/school-pack.json')
  } else {
    list.push('/etc/eduboard/school-pack.json')
  }
  try {
    list.push(join(dirname(app.getPath('exe')), 'school-pack.json'))
  } catch {
    // Not running inside Electron (tests).
  }
  return list
}

let current: ManagedBranding | null = null

/** The pack's value for each branding setting it sets. */
function brandingFrom(pack: ReturnType<typeof parseSchoolPack>): Partial<AppSettings> {
  const values: Partial<AppSettings> = {}
  if (pack.appName) values.appDisplayName = pack.appName
  if (pack.schoolName) values.schoolName = pack.schoolName
  if (pack.schoolLogo) values.schoolLogo = pack.schoolLogo
  if (pack.accentColor !== undefined) values.accentColor = pack.accentColor
  if (pack.customCss !== undefined) values.customCss = pack.customCss
  return values
}

/** Applies one computer-wide pack file: its branding every time, the rest once per version
 * of the file. Returns what's now locked, or null if the file isn't a usable pack. */
export function applyManagedPackFile(filePath: string): ManagedBranding | null {
  let text: string
  let pack: ReturnType<typeof parseSchoolPack>
  try {
    text = readFileSync(filePath, 'utf8')
    pack = parseSchoolPack(text)
  } catch (err) {
    logError({
      code: 'EB-2001',
      message: `The school pack for this computer (${filePath}) couldn’t be used: ${err instanceof Error ? err.message : String(err)}`,
      where: 'managed school pack'
    })
    return null
  }
  const settings = getSettings()
  const fingerprint = createHash('sha256').update(text).digest('hex')
  const branding = brandingFrom(pack)
  const patch: Partial<AppSettings> = {}

  if (getStoredValue<string>(APPLIED_KEY) !== fingerprint) {
    // A new or changed file: everything in it, as importing it by hand would.
    const existing = listTerms()
    const plan = planSchoolPack(pack, settings, existing)
    Object.assign(patch, plan.settings)
    let order = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0)
    for (const t of plan.newTerms) createTerm({ ...t, sortOrder: ++order })
    setStoredValue(APPLIED_KEY, fingerprint)
  }
  for (const [key, value] of Object.entries(branding)) {
    if (settings[key as keyof AppSettings] !== value)
      (patch as Record<string, unknown>)[key] = value
  }
  if (Object.keys(patch).length) updateSettings(patch)

  const locked = BRANDING_KEYS.filter((k) => k in branding) as BrandingKey[]
  return { filePath, locked }
}

/** At startup, once the database is open: finds and applies this computer's school pack.
 * The sample school is left alone (it's made up, with its own made-up school). */
export function applyManagedSchoolPack(): ManagedBranding | null {
  current = null
  if (isSampleSchool()) return null
  const file = managedPackCandidates().find((p) => existsSync(p))
  if (file) current = applyManagedPackFile(file)
  return current
}

export function managedBranding(): ManagedBranding | null {
  return current
}

export function lockedBrandingKeys(): readonly BrandingKey[] {
  return current?.locked ?? []
}
