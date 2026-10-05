import { describe, expect, it } from 'vitest'
import {
  normalizeStudentName,
  parseStudyProgressReturn,
  studentNameKeys
} from '@shared/studyProgress'

describe('study progress return parser', () => {
  it('accepts and normalizes a valid progress return', () => {
    const parsed = parseStudyProgressReturn({
      format: 'eduboard-study-progress',
      version: 1,
      resourceId: 'r1',
      resourceTitle: 'Museum vocabulary',
      studentName: ' Ada Lovelace ',
      exportedAt: '2026-10-01T06:00:00Z',
      cards: { got: 4, again: 1, total: 5 },
      quiz: { correct: 2, answered: 3, total: 4 }
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.studentName).toBe('Ada Lovelace')
      expect(parsed.value.exportedAt).toBe('2026-10-01T06:00:00.000Z')
    }
  })

  it('rejects impossible counts and unsupported formats', () => {
    expect(
      parseStudyProgressReturn({
        format: 'eduboard-study-progress',
        version: 1,
        resourceId: 'r1',
        resourceTitle: 'A',
        studentName: 'Student',
        exportedAt: '2026-10-01T06:00:00Z',
        cards: { got: 4, again: 4, total: 5 },
        quiz: { correct: 0, answered: 0, total: 0 }
      }).ok
    ).toBe(false)
    expect(parseStudyProgressReturn({ format: 'other', version: 1 }).ok).toBe(false)
  })
})

describe('student name keys', () => {
  it('match a typed name regardless of case and spacing, by full or preferred name', () => {
    const keys = studentNameKeys({ firstName: 'Wei', lastName: 'Li', preferredName: 'David' })
    expect(keys).toContain(normalizeStudentName('  WEI   li '))
    expect(keys).toContain(normalizeStudentName('David Li'))
    expect(keys).not.toContain(normalizeStudentName('Wei Lin'))
    expect(studentNameKeys({ firstName: 'Wei', lastName: 'Li', preferredName: ' ' })).toHaveLength(
      1
    )
  })
})
