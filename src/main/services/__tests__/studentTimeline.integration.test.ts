import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { markAttendance } from '../../repositories/attendanceRecords'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { addBehaviourPoint } from '../../repositories/behaviourPoints'
import { createStudentLogEntry } from '../../repositories/studentLogEntries'
import { setReportComment } from '../../repositories/reportComments'
import { studentTimeline } from '../studentTimeline'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-timeline-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('student timeline', () => {
  it('lists everything recorded about a student, newest first, from every class', () => {
    const newClass = (name: string): string =>
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
    const english = newClass('English')
    const maths = newClass('Maths')
    const mai = createStudent({
      firstName: 'Mai',
      lastName: 'Chen',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    }).id
    enrollStudent({ studentId: mai, classId: english, enrolledOn: '2026-09-01' })
    enrollStudent({ studentId: mai, classId: maths, enrolledOn: '2026-09-02' })

    markAttendance({ classId: english, studentId: mai, date: '2026-09-10', status: 'present' })
    markAttendance({
      classId: english,
      studentId: mai,
      date: '2026-09-11',
      status: 'absent',
      note: 'Dentist'
    })
    const quiz = createAssessment({
      classId: maths,
      categoryId: null,
      name: 'Fractions quiz',
      description: null,
      assessmentDate: '2026-09-15',
      maxScore: 20
    })
    upsertScore({ assessmentId: quiz.id, studentId: mai, pointsEarned: 17 })
    addBehaviourPoint({ classId: english, studentId: mai, points: 1 })
    addBehaviourPoint({ classId: english, studentId: mai, points: 1 })
    createStudentLogEntry({ studentId: mai, type: 'contact', text: 'Called mum about the trip' })
    setReportComment(english, mai, 'Mai reads every night.')

    const events = studentTimeline(mai)
    const kinds = events.map((e) => e.kind)
    expect(kinds.filter((k) => k === 'enrolled')).toHaveLength(2)
    // Only days that weren't "present".
    const absences = events.filter((e) => e.kind === 'attendance')
    expect(absences).toHaveLength(1)
    expect(absences[0]).toMatchObject({ date: '2026-09-11', className: 'English', text: 'Dentist' })
    expect(events.find((e) => e.kind === 'score')).toMatchObject({
      className: 'Maths',
      assessmentName: 'Fractions quiz',
      pointsEarned: 17,
      maxScore: 20,
      date: '2026-09-15'
    })
    // Two points on one day are one line.
    const points = events.filter((e) => e.kind === 'points')
    expect(points).toHaveLength(1)
    expect(points[0].pointItems?.[0].total).toBe(2)
    expect(events.find((e) => e.kind === 'note')).toMatchObject({ logType: 'contact' })
    expect(events.find((e) => e.kind === 'comment')?.text).toBe('Mai reads every night.')
    // Newest first.
    const times = events.map((e) => e.at)
    expect([...times].sort().reverse()).toEqual(times)
  })
})
