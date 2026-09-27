import { describe, expect, it } from 'vitest'
import { addDays, mondayOf } from '../dates'

describe('calendar dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05')
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-03-02', -7)).toBe('2026-02-23')
  })

  it('finds the Monday of any day', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28') // Monday
    expect(mondayOf('2026-10-04')).toBe('2026-09-28') // Sunday
    expect(mondayOf('2026-10-01')).toBe('2026-09-28')
  })
})
