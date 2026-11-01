// How students' names appear on shared screens: the pages the classroom tools serve on
// the school Wi-Fi (exit tickets, QR check-in, the classroom screen), which anyone in the
// room with the session link can open. Settings → What leaves this computer → Names on
// shared screens. The teacher's own screens always show full names.

export type SharedScreenNameFormat = 'full' | 'firstInitial' | 'number'

/** The setting as stored: '' follows the default (see sharedScreenNameFormat). */
export type SharedScreenNameSetting = '' | SharedScreenNameFormat

export const SHARED_SCREEN_NAME_FORMATS: readonly SharedScreenNameFormat[] = [
  'full',
  'firstInitial',
  'number'
]

/** Labels for Settings, through tr(). */
export const SHARED_SCREEN_NAME_LABELS: Record<SharedScreenNameFormat, string> = {
  full: 'Full name',
  firstInitial: 'First name + last initial',
  number: 'Student number only'
}

/** The format in use: the teacher's choice, or by default first name + last initial in a
 * local-only pilot and the full name otherwise. */
export function sharedScreenNameFormat(settings: {
  sharedScreenNames?: SharedScreenNameSetting
  pilotMode?: boolean
}): SharedScreenNameFormat {
  const chosen = settings.sharedScreenNames
  if (chosen && SHARED_SCREEN_NAME_FORMATS.includes(chosen)) return chosen
  return settings.pilotMode ? 'firstInitial' : 'full'
}

export interface NamedStudent {
  firstName: string
  lastName: string
  preferredName?: string | null
  studentNumber?: string | null
}

const first = (s: NamedStudent): string => s.preferredName?.trim() || s.firstName.trim()

/** The first character of a name (a whole character, so 李 or an emoji stays intact). */
const initial = (name: string): string => Array.from(name.trim())[0] ?? ''

function initials(s: NamedStudent): string {
  return [initial(first(s)), initial(s.lastName)]
    .filter(Boolean)
    .map((c) => `${c}.`)
    .join('')
}

/** One student's name in the given format. A student with no student number is shown
 * by their initials under "Student number only", never by name. */
export function sharedScreenName(student: NamedStudent, format: SharedScreenNameFormat): string {
  if (format === 'number') return student.studentNumber?.trim() || initials(student)
  if (format === 'firstInitial') {
    const last = initial(student.lastName)
    return last ? `${first(student)} ${last}.` : first(student)
  }
  return `${first(student)} ${student.lastName.trim()}`.trim()
}

/** Every student's name in the format, numbering any that would look the same ("Ming L.
 * (2)") so each student can still find their own. Same order as given. */
export function sharedScreenNames(
  students: readonly NamedStudent[],
  format: SharedScreenNameFormat
): string[] {
  const names = students.map((s) => sharedScreenName(s, format))
  const total = new Map<string, number>()
  for (const n of names) total.set(n, (total.get(n) ?? 0) + 1)
  const seen = new Map<string, number>()
  return names.map((n) => {
    if ((total.get(n) ?? 0) < 2) return n
    const k = (seen.get(n) ?? 0) + 1
    seen.set(n, k)
    return `${n} (${k})`
  })
}
