import { describe, expect, it } from 'vitest'
import { formatDueDate } from '../format'

describe('formatDueDate', () => {
  const now = new Date(2026, 8, 25, 15, 30) // Fri 25 Sep 2026, mid-afternoon local time

  it.each([
    ['2026-09-25', 'Fri 25 Sep · today'],
    ['2026-09-26', 'Sat 26 Sep · tomorrow'],
    ['2026-09-28', 'Mon 28 Sep · in 3 days'],
    ['2026-09-24', 'Thu 24 Sep · yesterday'],
    ['2026-09-23', 'Wed 23 Sep · 2 days ago'],
    ['2026-10-02T00:00:00.000Z', 'Fri 2 Oct · in 7 days']
  ])('%s → %s', (input, expected) => {
    expect(formatDueDate(input, now)).toBe(expected)
  })

  it('handles missing or broken dates', () => {
    expect(formatDueDate(null, now)).toBe('—')
    expect(formatDueDate('soon', now)).toBe('—')
  })
})
