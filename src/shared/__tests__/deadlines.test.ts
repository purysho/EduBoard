import { describe, expect, it } from 'vitest'
import { deadlineFor, isValidTimeZone, submissionTiming } from '../deadlines'
import cases from './deadlineCases.json'

describe('deadlineFor', () => {
  for (const c of cases.deadlines) {
    it(`${c.dueDate} in ${c.timeZone}`, () => {
      expect(deadlineFor(c.dueDate, c.timeZone)?.toISOString() ?? null).toBe(c.deadline)
    })
  }
})

describe('submissionTiming', () => {
  for (const c of cases.timing) {
    it(c.name, () => {
      expect(
        submissionTiming({
          dueDate: c.dueDate,
          status: c.status,
          submittedAt: c.submittedAt,
          timeZone: c.timeZone,
          now: new Date(c.now)
        })
      ).toBe(c.expected)
    })
  }
})

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone('Asia/Shanghai')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
  })
})
