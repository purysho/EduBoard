import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createScheduleSlot } from '../../repositories/classScheduleSlots'
import { createLessonPlan } from '../../repositories/lessonPlans'
import { markAttendance } from '../../repositories/attendanceRecords'
import { createStudentLogEntry } from '../../repositories/studentLogEntries'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { getTodayOverview, getWatchList } from '../today'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
const cls = (name: string): string =>
  createClass({
    name,
    subject: null,
    levelType: 'k12',
    gradeLevel: null,
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id
const student = (firstName: string, classId: string): string => {
  const id = createStudent({
    firstName,
    lastName: 'T',
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
  return id
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-today-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

// Monday 28 September 2026, mid-morning local time.
const monday = new Date(2026, 8, 28, 10, 0)

describe('today', () => {
  it('lists today’s lessons in time order, with attendance and lesson plan state', () => {
    const english = cls('English')
    const maths = cls('Maths')
    const kid = student('Mai', english)
    createScheduleSlot({
      classId: maths,
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '10:40',
      room: '12'
    })
    createScheduleSlot({
      classId: english,
      dayOfWeek: 1,
      startTime: '08:30',
      endTime: '09:10',
      room: null
    })
    createScheduleSlot({
      classId: english,
      dayOfWeek: 2,
      startTime: '08:30',
      endTime: '09:10',
      room: null
    })
    markAttendance({ classId: english, studentId: kid, date: '2026-09-28', status: 'present' })
    createLessonPlan({
      classId: maths,
      date: '2026-09-28',
      weekLabel: null,
      title: 'Fractions',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    createStudentLogEntry({
      studentId: kid,
      type: 'contact',
      text: 'Call back',
      followUpNeeded: true
    })
    const t = getTodayOverview(monday)
    expect(t.date).toBe('2026-09-28')
    expect(t.lessons.map((l) => [l.className, l.attendanceTaken, l.lessonPlanTitle])).toEqual([
      ['English', true, null],
      ['Maths', false, 'Fractions']
    ])
    expect(t.followUpsDue).toBe(1)
  })
})

describe('students to check on', () => {
  it('lists students below the pass mark or with repeated concerns, most reasons first', () => {
    const c = cls('English')
    const low = student('Low', c)
    const worried = student('Worried', c)
    student('Fine', c)
    const test = createAssessment({
      classId: c,
      categoryId: null,
      name: 'Test',
      description: null,
      assessmentDate: '2026-09-20',
      maxScore: 100
    })
    upsertScore({ assessmentId: test.id, studentId: low, pointsEarned: 40 })
    for (let i = 0; i < 3; i++)
      createStudentLogEntry({ studentId: worried, type: 'concern', text: `c${i}` })
    createStudentLogEntry({ studentId: low, type: 'concern', text: 'x' })
    const list = getWatchList(new Date())
    expect(list.map((e) => [e.studentName, e.reasons.length])).toEqual([
      ['Low T', 1],
      ['Worried T', 1]
    ])
    expect(list[0].reasons[0]).toMatch(/Below the pass mark \(40% vs 60%\)/)
    expect(list[1].reasons[0]).toBe('3 concerns logged in 30 days')
  })
})
