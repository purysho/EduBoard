import { format, parseISO, isValid } from 'date-fns'

export function formatDate(value: string | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!value) return '—'
  const date = value.length === 10 ? parseISO(value) : new Date(value)
  return isValid(date) ? format(date, pattern) : '—'
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
