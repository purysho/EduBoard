import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../classes'
import { createStudent, getStudent } from '../students'
import { enrollStudent, listEnrollmentsByStudent } from '../enrollments'
import { mergeStudents } from '../studentMerge'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

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

const makeClass = (name: string): string =>
  createClass({
    name,
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

const makeStudent = (firstName: string, lastName: string, extra = {}): string =>
  createStudent({
    firstName,
    lastName,
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null,
    ...extra
  }).id

describe('merging a duplicate student', () => {
  it('moves classes and records to the kept student and removes the duplicate', () => {
    const english = makeClass('English')
    const writing = makeClass('Writing')
    const keep = makeStudent('Mai', 'Chen', { studentNumber: 'S1' })
    const dup = makeStudent('Chen', 'Mai', { dateOfBirth: '2006-05-05', studentNumber: 'S2' })
    enrollStudent({ studentId: keep, classId: english, enrolledOn: '2026-09-01' })
    // Both are in English (a clash); only the duplicate is in Writing.
    enrollStudent({ studentId: dup, classId: english, enrolledOn: '2026-09-10' })
    enrollStudent({ studentId: dup, classId: writing, enrolledOn: '2026-09-10' })

    const merged = mergeStudents(keep, dup)

    expect(getStudent(dup)).toBeUndefined()
    const classes = listEnrollmentsByStudent(keep)
      .map((e) => e.classId)
      .sort()
    expect(classes).toEqual([english, writing].sort())
    // The kept student's own details win; blanks are filled from the duplicate.
    expect(merged.studentNumber).toBe('S1')
    expect(merged.dateOfBirth).toBe('2006-05-05')
    expect(merged.firstName).toBe('Mai')
  })

  it('refuses to merge a student with themself', () => {
    const keep = makeStudent('Mai', 'Chen')
    expect(() => mergeStudents(keep, keep)).toThrow(/two different/)
  })
})
