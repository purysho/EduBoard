// Plain-JS copy of src/shared/deadlines.ts (the Portal has no build step). A due date
// means "by the end of that day in the teacher's time zone": the deadline is 00:00 on
// the next day there. Both copies are tested against src/shared/__tests__/
// deadlineCases.json; change them together.

function zoneOffsetMs(instant, timeZone) {
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
  const get = (type) => Number(parts.find((p) => p.type === type)?.value)
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

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

function deadlineFor(dueDate, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate ?? '')
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const nextMidnightWallClock = Date.UTC(y, m - 1, d + 1)
  let instant = nextMidnightWallClock - zoneOffsetMs(nextMidnightWallClock, timeZone)
  instant = nextMidnightWallClock - zoneOffsetMs(instant, timeZone)
  return new Date(instant)
}

/** 'on_time' | 'late' | 'missing' | 'not_due', or null when there's nothing to judge. */
function submissionTiming({ dueDate, status, submittedAt, timeZone, now = new Date() }) {
  const deadline = deadlineFor(dueDate, timeZone)
  if (!deadline) return null
  if (!submittedAt && status !== 'not_started') return null
  if (submittedAt) {
    return new Date(submittedAt).getTime() >= deadline.getTime() ? 'late' : 'on_time'
  }
  return now.getTime() >= deadline.getTime() ? 'missing' : 'not_due'
}

// Used when a teacher's desktop app hasn't sent its time zone yet (published before
// this feature existed). PORTAL_TIMEZONE lets a school set its own.
const DEFAULT_TIMEZONE = isValidTimeZone(process.env.PORTAL_TIMEZONE)
  ? process.env.PORTAL_TIMEZONE
  : 'UTC'

module.exports = { deadlineFor, submissionTiming, isValidTimeZone, DEFAULT_TIMEZONE }
