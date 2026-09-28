// A school can show its own name for the app, its logo and colour (decorative only:
// the program, its updates, the installer and edu-board.com stay EduBoard). A school
// pack installed for the whole computer (main/services/managedSchoolPack.ts) sets them for
// every teacher and locks them.

export const PRODUCT_NAME = 'EduBoard'
export const MAX_APP_NAME = 40

/** The settings a computer-wide school pack locks: re-applied at every start, and not
 * changeable in Settings. Everything else in the pack is only a starting point. */
export const BRANDING_KEYS = [
  'appDisplayName',
  'schoolName',
  'schoolLogo',
  'accentColor',
  'customCss'
] as const
export type BrandingKey = (typeof BRANDING_KEYS)[number]

/** Where a computer-wide school pack came from, for Settings to explain the lock. */
export interface ManagedBranding {
  filePath: string
  locked: BrandingKey[]
}

/** An app name as a school typed it: one line, no control characters, at most 40
 * characters. '' means EduBoard's own name. */
export function cleanAppName(name: unknown): string {
  if (typeof name !== 'string') return ''
  return [
    ...name
      .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  ]
    .slice(0, MAX_APP_NAME)
    .join('')
    .trim()
}

/** The name to show for the app. */
export function displayAppName(settings: { appDisplayName?: string } | null | undefined): string {
  return cleanAppName(settings?.appDisplayName) || PRODUCT_NAME
}

/** Two letters for the badge when there's no logo: "EB", "RH" for "Riverside Hub", or the
 * first two characters of a Chinese name. */
export function appInitials(name: string): string {
  if (name === PRODUCT_NAME) return 'EB'
  const words = name.split(' ').filter(Boolean)
  if (/^[\p{Script=Han}]/u.test(name)) return [...name.replace(/\s/g, '')].slice(0, 2).join('')
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => [...w][0]) : [...name].slice(0, 2)
  return letters.join('').toUpperCase()
}

/** A settings change with the locked keys taken out. */
export function withoutLocked<T extends object>(patch: T, locked: readonly BrandingKey[]): T {
  const copy = { ...patch } as Record<string, unknown>
  for (const key of locked) delete copy[key]
  return copy as T
}
