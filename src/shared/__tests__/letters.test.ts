import { describe, expect, it } from 'vitest'
import { DEFAULT_LETTER_TEMPLATE, fillLetter } from '../letters'

const ctx = {
  name: 'Mai',
  guardian: 'Mrs Chen',
  className: 'Grade 4 English',
  grade: 'A',
  percent: 91.4,
  attendanceRate: 0.955,
  teacher: 'Mr Oliver',
  school: 'Riverside Primary',
  date: '28 September 2026'
}

describe('parent letters', () => {
  it('fills every placeholder in the default letter', () => {
    const letter = fillLetter(DEFAULT_LETTER_TEMPLATE, ctx)
    expect(letter).toContain('Dear Mrs Chen,')
    expect(letter).toContain("Mai's current grade is A (91%), and attendance so far is 96%.")
    expect(letter).toMatch(/Mr Oliver\nRiverside Primary$/)
    expect(letter).not.toMatch(/\{\w+\}/)
  })

  it('reads sensibly without a guardian, grade or attendance on file', () => {
    const letter = fillLetter('Dear {guardian}, {grade} / {percent} / {attendance}', {
      ...ctx,
      guardian: null,
      grade: null,
      percent: null,
      attendanceRate: null
    })
    expect(letter).toBe(
      'Dear Parent or guardian of Mai, not yet available / not yet available / not yet available'
    )
  })
})
