import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns'

export function formatDate(value: string | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!value) return '—'
  const date = value.length === 10 ? parseISO(value) : new Date(value)
  return isValid(date) ? format(date, pattern) : '—'
}

/** A due date as people say it: "Mon 28 Sep · in 3 days", "Fri 25 Sep · today",
 * "Wed 23 Sep · 2 days ago". Relative to `now`, in local calendar days. */
export function formatDueDate(value: string | null | undefined, now = new Date()): string {
  if (!value) return '—'
  const date = parseISO(value.slice(0, 10))
  if (!isValid(date)) return '—'
  const n = differenceInCalendarDays(date, now)
  const rel =
    n === 0
      ? 'today'
      : n === 1
        ? 'tomorrow'
        : n === -1
          ? 'yesterday'
          : n > 1
            ? `in ${n} days`
            : `${-n} days ago`
  return `${format(date, 'EEE d MMM')} · ${rel}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(0)}%`
}

export function studentFullName(student: { firstName: string; lastName: string }): string {
  return `${student.firstName} ${student.lastName}`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Electron's ipcMain.handle rejects with "Error invoking remote method '<channel>':
 * <ErrorClass>: <message>" — every error thrown in a main-process handler picks up that
 * prefix, so a message meant for a teacher (like "add an API key in Settings") arrives
 * wrapped in implementation detail. Strips it back down to the original message. */
export function ipcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  const match = error.message.match(/Error invoking remote method '[^']*': (?:\w*Error: )?(.*)/s)
  return match ? match[1] : error.message
}
