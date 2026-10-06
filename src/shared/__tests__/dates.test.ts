import { describe, expect, it } from 'vitest'
import { addDays, localDateIso, mondayOf } from '../dates'

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

describe('localDateIso', () => {
  it("is the teacher's own date, not UTC's: 7:30 in Beijing is still yesterday in UTC", () => {
    const original = process.env.TZ
    process.env.TZ = 'Asia/Shanghai'
    try {
      const morning = new Date('2026-10-07T23:30:00Z') // 07:30 on 8 October in Beijing
      expect(morning.toISOString().slice(0, 10)).toBe('2026-10-07')
      expect(localDateIso(morning)).toBe('2026-10-08')
    } finally {
      process.env.TZ = original
    }
  })
})
