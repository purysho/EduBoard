import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { tr, trMaybe, trn, uiLanguage } from '@shared/i18n'

// The date patterns the app uses, and how Chinese writes each one.
const ZH_PATTERNS: Record<string, string> = {
  'MMM d, yyyy': 'yyyy年M月d日',
  'MMM d, yyyy p': 'yyyy年M月d日 HH:mm',
  'MMM d, yyyy h:mm a': 'yyyy年M月d日 HH:mm',
  'MMM d': 'M月d日',
  'MMMM d': 'M月d日',
  'MMM d, p': 'M月d日 HH:mm',
  'MMMM yyyy': 'yyyy年M月',
  'EEEE, MMMM d': 'M月d日 EEEE',
  'EEE d MMM': 'M月d日 EEE'
}

/** date-fns format in the interface language: Chinese patterns and day names in
 * Chinese, the pattern as given in English. */
export function formatLocal(date: Date, pattern: string): string {
  if (uiLanguage() === 'zh') return format(date, ZH_PATTERNS[pattern] ?? pattern, { locale: zhCN })
  return format(date, pattern)
}

export function formatDate(value: string | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!value) return '—'
  const date = value.length === 10 ? parseISO(value) : new Date(value)
  return isValid(date) ? formatLocal(date, pattern) : '—'
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
      ? tr('today')
      : n === 1
        ? tr('tomorrow')
        : n === -1
          ? tr('yesterday')
          : n > 1
            ? trn('in {n} day', 'in {n} days', n)
            : trn('{n} day ago', '{n} days ago', -n)
  return `${formatLocal(date, 'EEE d MMM')} · ${rel}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(0)}%`
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/

/** A student's name as people write it: "Mai Chen", and a Chinese name family name
 * first with no space ("陈麦"). */
export function studentFullName(student: { firstName: string; lastName: string }): string {
  if (CJK.test(student.firstName) && CJK.test(student.lastName)) {
    return `${student.lastName}${student.firstName}`
  }
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
  // Messages from the main process are English; show the translation when there is one.
  return trMaybe(match ? match[1] : error.message)
}
