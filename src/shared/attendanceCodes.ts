// Attendance codes: the four built-in statuses plus any the school adds ("Sick", "Field
// trip", "School event"…). Every code counts as one of the four for attendance rates,
// so a custom code never changes how a rate is worked out, only what it's called.
// Records store the code's id. Custom codes are hidden, never deleted, so days already
// marked with one keep counting the same way.
import type { AttendanceStatus } from './types'
import { tr, uiLanguage } from './i18n'

export interface AttendanceCode {
  /** Stored on each record: a built-in status, or "c:" + a random id for the school's own. */
  id: string
  /** Blank on a built-in code means its usual name in the interface language. */
  label: string
  /** One or two characters for the attendance grid; blank on a built-in means its usual one. */
  letter: string
  countsAs: AttendanceStatus
  /** No longer offered for new marks; existing records still use it. */
  hidden?: boolean
}

export const BUILT_IN_STATUSES: readonly AttendanceStatus[] = [
  'present',
  'late',
  'absent',
  'excused'
]

const builtInLabel = (s: AttendanceStatus): string =>
  ({ present: tr('Present'), late: tr('Late'), absent: tr('Absent'), excused: tr('Excused') })[s]

// Single letters don't go through tr(): 'A' is too easily a key for something else.
const builtInLetter = (s: AttendanceStatus): string =>
  uiLanguage() === 'zh'
    ? { present: '到', late: '迟', absent: '缺', excused: '假' }[s]
    : { present: 'P', late: 'L', absent: 'A', excused: 'E' }[s]

const isBuiltIn = (id: string): id is AttendanceStatus =>
  (BUILT_IN_STATUSES as readonly string[]).includes(id)

/** The full list in order: the four built-ins (with any renaming), then the school's own.
 * Built-ins can be renamed but not hidden, since check-in and "mark all present" use them. */
export function resolveAttendanceCodes(saved: AttendanceCode[] | undefined): AttendanceCode[] {
  const byId = new Map((saved ?? []).map((c) => [c.id, c]))
  const builtIns = BUILT_IN_STATUSES.map((s) => {
    const own = byId.get(s)
    return {
      id: s,
      label: own?.label.trim() || builtInLabel(s),
      letter: own?.letter.trim() || builtInLetter(s),
      countsAs: s
    }
  })
  const custom = (saved ?? [])
    .filter((c) => !isBuiltIn(c.id))
    .map((c) => ({
      ...c,
      label: c.label.trim(),
      letter: c.letter.trim() || c.label.trim().slice(0, 1)
    }))
  return [...builtIns, ...custom]
}

/** How a record's code counts toward the rate. A code nobody knows any more (removed by
 * hand from a settings file, say) counts as excused, so it never lowers a rate. */
export function countsAsFor(codes: AttendanceCode[]): (status: string) => AttendanceStatus {
  const map = new Map(codes.map((c) => [c.id, c.countsAs]))
  return (status) => (isBuiltIn(status) ? status : (map.get(status) ?? 'excused'))
}

/** Problems with codes the teacher is editing, in plain words, or null if they're fine. */
export function attendanceCodeProblem(codes: AttendanceCode[]): string | null {
  const custom = codes.filter((c) => !isBuiltIn(c.id))
  if (custom.some((c) => !c.label.trim())) return tr('Every attendance code needs a name.')
  if (codes.some((c) => [...c.letter.trim()].length > 2)) {
    return tr('A code’s short form can be at most two characters.')
  }
  const labels = resolveAttendanceCodes(codes).map((c) => c.label.toLowerCase())
  if (new Set(labels).size !== labels.length) return tr('Two attendance codes have the same name.')
  if (custom.some((c) => !BUILT_IN_STATUSES.includes(c.countsAs))) {
    return tr('Choose how each code counts.')
  }
  return null
}

/** A new custom code's id. */
export function newAttendanceCodeId(): string {
  return `c:${Math.random().toString(36).slice(2, 10)}`
}
