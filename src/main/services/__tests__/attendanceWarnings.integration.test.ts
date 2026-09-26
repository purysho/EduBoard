import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass, updateClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { markAttendance } from '../../repositories/attendanceRecords'
import { getAttendanceWarnings } from '../reports'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import type { AttendanceRecord } from '@shared/types'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

const makeClass = (): string =>
  createClass({
    name: 'Writing',
    subject: null,
    levelType: 'university',
    gradeLevel: null,
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id

function student(classId: string, name: string, days: AttendanceRecord['status'][]): string {
  const id = createStudent({
    firstName: name,
    lastName: 'Test',
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  }).id
  enrollStudent({ studentId: id, classId, enrolledOn: '2026-09-01' })
  days.forEach((status, i) =>
    markAttendance({
      classId,
      studentId: id,
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      status
    })
  )
  return id
}

describe('attendance warnings', () => {
  it('lists students under the class minimum, lowest first, once there are enough sessions', () => {
    const cls = makeClass()
    const low = student(cls, 'Low', ['present', 'absent', 'absent', 'absent']) // 25%
    const edge = student(cls, 'Edge', ['present', 'present', 'present', 'absent', 'absent']) // 60%
    student(cls, 'Fine', ['present', 'present', 'present', 'late']) // 100%
    student(cls, 'Excused', ['present', 'present', 'present', 'excused', 'excused']) // 100%
    student(cls, 'TooEarly', ['absent', 'absent']) // only two sessions

    // No requirement set: nothing to report.
    expect(getAttendanceWarnings()).toEqual([])

    updateClass(cls, { minAttendance: 80 })
    const warnings = getAttendanceWarnings()
    expect(warnings.map((w) => w.studentId)).toEqual([low, edge])
    expect(warnings[0]).toMatchObject({ rate: 0.25, absent: 3, sessions: 4, minAttendance: 80 })

    // Exactly at the minimum is fine.
    updateClass(cls, { minAttendance: 60 })
    expect(getAttendanceWarnings().map((w) => w.studentId)).toEqual([low])
  })
})
