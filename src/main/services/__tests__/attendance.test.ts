import { describe, expect, it } from 'vitest'
import { computeAttendanceCounts } from '../attendance'

describe('computeAttendanceCounts', () => {
  it('returns null rate when there are no counted records', () => {
    const result = computeAttendanceCounts([])
    expect(result.rate).toBeNull()
  })

  it('excludes excused days from the denominator', () => {
    const result = computeAttendanceCounts([
      { status: 'present' },
      { status: 'present' },
      { status: 'absent' },
      { status: 'excused' }
    ])
    // present+late = 2, counted total = present+late+absent = 3, excused ignored
    expect(result.rate).toBeCloseTo(2 / 3, 5)
    expect(result.excused).toBe(1)
  })

  it('counts late as attended', () => {
    const result = computeAttendanceCounts([{ status: 'late' }, { status: 'absent' }])
    expect(result.rate).toBe(0.5)
  })

  it('treats a fully present run as a 100% rate', () => {
    const result = computeAttendanceCounts([{ status: 'present' }, { status: 'present' }])
    expect(result.rate).toBe(1)
  })
})
