// When is homework late? A due date is a calendar day ("2026-10-02"), and "due on the
// 2nd" means "by the end of the 2nd where the teacher is". Not UTC, and not wherever
// the student or the server happens to be. So the deadline is the first instant of the
// *next* day in the teacher's IANA time zone, and a submission at or after it is late.
//
// portal/services/deadlines.js is a plain-JS copy of this file (the Portal has no build
// step). Both are tested against the same cases; change them together.

export type SubmissionTiming = 'on_time' | 'late' | 'missing' | 'not_due'

/** Milliseconds to add to UTC to get wall-clock time in `timeZone` at `instant`. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(instant))
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  )
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** True if `timeZone` is a zone this runtime recognises. */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** The instant a due date stops being on time: 00:00 on the following day in
 * `timeZone`. Returns null for a missing or unparseable due date. */
export function deadlineFor(dueDate: string | null | undefined, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate ?? '')
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const nextMidnightWallClock = Date.UTC(y, m - 1, d + 1)
  // Wall-clock midnight minus the zone's offset gives the UTC instant. Check the offset
  // again at that instant, because a DST change can fall between the two.
  let instant = nextMidnightWallClock - zoneOffsetMs(nextMidnightWallClock, timeZone)
  instant = nextMidnightWallClock - zoneOffsetMs(instant, timeZone)
  return new Date(instant)
}

/** Classifies one student's work on one assignment. Turned-in work is judged by when it
 * was turned in. Work never started is "missing" once the deadline passes. Returns null
 * when there's nothing to judge: no due date, or work the teacher marked done without a
 * submission time (e.g. graded from paper). */
export function submissionTiming(input: {
  dueDate: string | null | undefined
  status: string
  submittedAt: string | null | undefined
  timeZone: string
  now?: Date
}): SubmissionTiming | null {
  const deadline = deadlineFor(input.dueDate, input.timeZone)
  if (!deadline) return null
  if (!input.submittedAt && input.status !== 'not_started') return null
  if (input.submittedAt) {
    return new Date(input.submittedAt).getTime() >= deadline.getTime() ? 'late' : 'on_time'
  }
  return (input.now ?? new Date()).getTime() >= deadline.getTime() ? 'missing' : 'not_due'
}
