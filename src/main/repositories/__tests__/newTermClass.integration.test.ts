import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass, getClass, listClasses } from '../classes'
import { createStudent } from '../students'
import { enrollStudent, getRosterForClass, updateEnrollmentStatus } from '../enrollments'
import { createGradeCategory, listGradeCategories } from '../gradeCategories'
import { createTerm, updateTerm } from '../terms'
import { duplicateClassForNewTerm, startNextTermForClasses } from '../newTermClass'
import { createScheduleSlot, listScheduleSlotsByClass } from '../classScheduleSlots'
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

function makeTerm(name: string): string {
  return createTerm({
    name,
    schoolYear: '2026-2027',
    startDate: null,
    endDate: null,
    sortOrder: 0
  }).id
}

function makeStudent(firstName: string): string {
  return createStudent({
    firstName,
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
}

function makeTerm1Class(): string {
  const id = createClass({
    name: 'University English',
    subject: 'English',
    levelType: 'university',
    gradeLevel: null,
    termId: makeTerm('Term 1'),
    schedule: 'Mon 9:00',
    room: 'B201',
    color: null,
    passMark: 50,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id
  createGradeCategory({ classId: id, name: 'Essays', weightPercent: 60, sortOrder: 0 })
  createGradeCategory({ classId: id, name: 'Exam', weightPercent: 40, sortOrder: 1 })
  return id
}

describe('starting the next term of a class', () => {
  it('copies the setup and the active students, under the chosen term', () => {
    const term1Class = makeTerm1Class()
    const mai = makeStudent('Mai')
    const leo = makeStudent('Leo')
    const gone = makeStudent('Gone')
    for (const s of [mai, leo, gone]) {
      enrollStudent({ studentId: s, classId: term1Class, enrolledOn: '2026-09-01' })
    }
    const goneEnrollment = getRosterForClass(term1Class).find((r) => r.student.id === gone)!
    updateEnrollmentStatus(goneEnrollment.enrollment.id, 'dropped')
    const term2 = makeTerm('Term 2')

    const created = duplicateClassForNewTerm(term1Class, {
      name: 'University English (Term 2)',
      termId: term2,
      copyStudents: true
    })

    expect(created.name).toBe('University English (Term 2)')
    expect(created.termId).toBe(term2)
    expect(created.passMark).toBe(50)
    expect(created.room).toBe('B201')
    expect(listGradeCategories(created.id).map((c) => [c.name, c.weightPercent])).toEqual([
      ['Essays', 60],
      ['Exam', 40]
    ])
    // Same student records (so Portal logins carry over); the dropped student stays behind.
    const roster = getRosterForClass(created.id)
    expect(roster.map((r) => r.student.id).sort()).toEqual([mai, leo].sort())
    expect(roster.every((r) => r.enrollment.status === 'active')).toBe(true)
    // The Term 1 class is untouched.
    expect(getRosterForClass(term1Class)).toHaveLength(3)
    expect(getClass(term1Class)?.name).toBe('University English')
  })

  it('can leave the students behind', () => {
    const term1Class = makeTerm1Class()
    enrollStudent({ studentId: makeStudent('Mai'), classId: term1Class, enrolledOn: '2026-09-01' })

    const created = duplicateClassForNewTerm(term1Class, {
      name: '',
      termId: null,
      copyStudents: false
    })

    expect(created.name).toBe('University English')
    expect(created.termId).toBeNull()
    expect(getRosterForClass(created.id)).toHaveLength(0)
  })
})

describe('editing a term', () => {
  it('changes its dates later, keeping the classes that use it', () => {
    const termId = makeTerm('Term 2')
    const classId = createClass({
      name: 'Class',
      subject: null,
      levelType: 'k12',
      gradeLevel: null,
      termId,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    }).id

    const updated = updateTerm(termId, { startDate: '2027-02-20', endDate: '2027-06-30' })

    expect(updated.startDate).toBe('2027-02-20')
    expect(updated.endDate).toBe('2027-06-30')
    expect(getClass(classId)?.termId).toBe(termId)
  })
})

describe('starting the next term for several classes at once', () => {
  const classIn = (name: string, termId: string): string =>
    createClass({
      name,
      subject: null,
      levelType: 'k12',
      gradeLevel: null,
      termId,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    }).id

  it('makes a next-term class for each, with students and timetable, and archives the old', () => {
    const t1 = makeTerm('Term 1')
    const t2 = makeTerm('Term 2')
    const a = classIn('4A English', t1)
    const b = classIn('4B English', t1)
    const mai = makeStudent('Mai')
    enrollStudent({ studentId: mai, classId: a, enrolledOn: '2026-09-01' })
    createScheduleSlot({
      classId: a,
      dayOfWeek: 1,
      startTime: '08:30',
      endTime: '09:10',
      room: '204'
    })

    const result = startNextTermForClasses({
      classIds: [a, b],
      termId: t2,
      copyStudents: true,
      copyTimetable: true,
      archiveOld: true
    })
    expect(result).toEqual({ created: 2, skipped: [] })

    const next = listClasses().filter((c) => c.termId === t2)
    expect(next.map((c) => c.name).sort()).toEqual(['4A English', '4B English'])
    const nextA = next.find((c) => c.name === '4A English')!
    expect(getRosterForClass(nextA.id).map((r) => r.student.id)).toEqual([mai])
    expect(listScheduleSlotsByClass(nextA.id)).toMatchObject([
      { dayOfWeek: 1, startTime: '08:30', room: '204' }
    ])
    expect(getClass(a)?.archived).toBe(true)
    expect(getClass(b)?.archived).toBe(true)
  })

  it('skips a class the next term already has, so running it twice makes no doubles', () => {
    const t1 = makeTerm('Term 1')
    const t2 = makeTerm('Term 2')
    const a = classIn('4A English', t1)
    const input = {
      classIds: [a],
      termId: t2,
      copyStudents: false,
      copyTimetable: false,
      archiveOld: false
    }
    expect(startNextTermForClasses(input).created).toBe(1)
    expect(startNextTermForClasses(input)).toEqual({ created: 0, skipped: ['4A English'] })
    expect(listClasses().filter((c) => c.termId === t2)).toHaveLength(1)
    expect(getClass(a)?.archived).toBe(false)
  })
})
