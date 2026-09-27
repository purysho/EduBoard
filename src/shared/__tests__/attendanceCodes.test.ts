import { describe, expect, it } from 'vitest'
import {
  attendanceCodeProblem,
  countsAsFor,
  resolveAttendanceCodes,
  type AttendanceCode
} from '../attendanceCodes'
import { computeAttendanceCounts } from '../../main/services/attendance'
import { parseSchoolPack, planSchoolPack, makeSchoolPack } from '../schoolPack'
import { DEFAULT_APP_SETTINGS } from '../types'

const sick: AttendanceCode = { id: 'c:sick', label: 'Sick', letter: 'S', countsAs: 'excused' }
const trip: AttendanceCode = { id: 'c:trip', label: 'Field trip', letter: 'T', countsAs: 'present' }

describe('attendance codes', () => {
  it('always has the four built-ins first, renamed if the school renamed them', () => {
    const codes = resolveAttendanceCodes([
      { id: 'late', label: 'Tardy', letter: 'T', countsAs: 'late' },
      sick
    ])
    expect(codes.map((c) => c.id)).toEqual(['present', 'late', 'absent', 'excused', 'c:sick'])
    expect(codes[1]).toMatchObject({ label: 'Tardy', letter: 'T' })
    expect(codes[0]).toMatchObject({ label: 'Present', letter: 'P' })
  })

  it('counts each custom code as what it stands for', () => {
    const countsAs = countsAsFor(resolveAttendanceCodes([sick, trip]))
    const records = ['present', 'c:trip', 'absent', 'c:sick', 'c:gone'].map((status) => ({
      status
    }))
    // Field trip is present, Sick and an unknown code are excused (left out of the rate).
    expect(computeAttendanceCounts(records, countsAs)).toEqual({
      present: 2,
      late: 0,
      absent: 1,
      excused: 2,
      rate: 2 / 3
    })
  })

  it('refuses unnamed or clashing codes', () => {
    expect(attendanceCodeProblem([sick, trip])).toBeNull()
    expect(attendanceCodeProblem([{ ...sick, label: ' ' }])).toMatch(/needs a name/)
    expect(attendanceCodeProblem([sick, { ...trip, label: 'sick' }])).toMatch(/same name/)
    expect(attendanceCodeProblem([{ ...sick, letter: 'ABC' }])).toMatch(/two characters/)
  })

  it('travels in a school pack without dropping codes this computer already uses', () => {
    const from = { ...DEFAULT_APP_SETTINGS, attendanceCodes: [sick, trip] }
    const pack = parseSchoolPack(JSON.stringify(makeSchoolPack(from, [])))
    const here = {
      ...DEFAULT_APP_SETTINGS,
      attendanceCodes: [
        { ...sick, label: 'Ill' },
        { id: 'c:mine', label: 'Mine', letter: 'M', countsAs: 'present' as const }
      ]
    }
    const plan = planSchoolPack(pack, here, [])
    expect(plan.settings.attendanceCodes?.map((c) => [c.id, c.label])).toEqual([
      ['c:sick', 'Sick'],
      ['c:mine', 'Mine'],
      ['c:trip', 'Field trip']
    ])
  })

  it('drops malformed codes from a pack', () => {
    const pack = parseSchoolPack(
      JSON.stringify({
        kind: 'eduboard-school-pack',
        version: 1,
        attendanceCodes: [
          { id: 'drop table', label: 'x', letter: 'x', countsAs: 'present' },
          { id: 'present', label: 'Here', letter: 'H', countsAs: 'absent' },
          { id: 'c:ok', label: 'Ok', letter: 'O', countsAs: 'late' }
        ]
      })
    )
    expect(pack.attendanceCodes?.map((c) => c.id)).toEqual(['c:ok'])
  })
})
