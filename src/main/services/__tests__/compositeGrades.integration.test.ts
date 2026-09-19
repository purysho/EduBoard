import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createStudent } from '../../repositories/students'
import { createClass } from '../../repositories/classes'
import { createTerm } from '../../repositories/terms'
import { createCourseGroup } from '../../repositories/courseGroups'
import { enrollStudent } from '../../repositories/enrollments'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { getCourseGroupComposite } from '../compositeGrades'
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

describe('composite grades', () => {
  it('weights each term equally by default and renormalizes over graded terms', () => {
    const group = createCourseGroup({ name: 'Algebra I' })
    const fall = createTerm({
      name: 'Fall',
      schoolYear: '2025-26',
      startDate: null,
      endDate: null,
      sortOrder: 0
    })
    const spring = createTerm({
      name: 'Spring',
      schoolYear: '2025-26',
      startDate: null,
      endDate: null,
      sortOrder: 1
    })

    const fallClass = createClass({
      name: 'Algebra I',
      subject: 'Math',
      levelType: 'k12',
      gradeLevel: null,
      termId: fall.id,
      courseGroupId: group.id,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const springClass = createClass({
      name: 'Algebra I',
      subject: 'Math',
      levelType: 'k12',
      gradeLevel: null,
      termId: spring.id,
      courseGroupId: group.id,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })

    const student = createStudent({
      firstName: 'Rae',
      lastName: 'Kim',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    enrollStudent({ studentId: student.id, classId: fallClass.id, enrolledOn: '2025-09-01' })
    enrollStudent({ studentId: student.id, classId: springClass.id, enrolledOn: '2026-01-15' })

    const fallAssessment = createAssessment({
      classId: fallClass.id,
      categoryId: null,
      name: 'Exam',
      description: null,
      assessmentDate: null,
      maxScore: 100
    })
    upsertScore({
      assessmentId: fallAssessment.id,
      studentId: student.id,
      pointsEarned: 80,
      excused: false
    })

    // Spring has no graded work yet — composite should be based on Fall alone, not
    // treat the ungraded term as a zero.
    let composites = getCourseGroupComposite(group.id)
    expect(composites).toHaveLength(1)
    expect(composites[0].compositePercent).toBe(80)
    expect(composites[0].classes.map((c) => c.percent)).toEqual([80, null])

    const springAssessment = createAssessment({
      classId: springClass.id,
      categoryId: null,
      name: 'Exam',
      description: null,
      assessmentDate: null,
      maxScore: 100
    })
    upsertScore({
      assessmentId: springAssessment.id,
      studentId: student.id,
      pointsEarned: 100,
      excused: false
    })

    composites = getCourseGroupComposite(group.id)
    expect(composites[0].compositePercent).toBe(90)
  })

  it('weights a term proportionally to its termWeight', () => {
    const group = createCourseGroup({ name: 'History' })
    const t1 = createTerm({
      name: 'T1',
      schoolYear: '2025-26',
      startDate: null,
      endDate: null,
      sortOrder: 0
    })
    const t2 = createTerm({
      name: 'T2',
      schoolYear: '2025-26',
      startDate: null,
      endDate: null,
      sortOrder: 1
    })

    const class1 = createClass({
      name: 'History',
      subject: null,
      levelType: 'k12',
      gradeLevel: null,
      termId: t1.id,
      courseGroupId: group.id,
      termWeight: 1,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const class2 = createClass({
      name: 'History',
      subject: null,
      levelType: 'k12',
      gradeLevel: null,
      termId: t2.id,
      courseGroupId: group.id,
      termWeight: 3,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })

    const student = createStudent({
      firstName: 'Lu',
      lastName: 'Park',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    enrollStudent({ studentId: student.id, classId: class1.id, enrolledOn: '2025-09-01' })
    enrollStudent({ studentId: student.id, classId: class2.id, enrolledOn: '2026-01-15' })

    const a1 = createAssessment({
      classId: class1.id,
      categoryId: null,
      name: 'Exam',
      description: null,
      assessmentDate: null,
      maxScore: 100
    })
    upsertScore({ assessmentId: a1.id, studentId: student.id, pointsEarned: 60, excused: false })
    const a2 = createAssessment({
      classId: class2.id,
      categoryId: null,
      name: 'Exam',
      description: null,
      assessmentDate: null,
      maxScore: 100
    })
    upsertScore({ assessmentId: a2.id, studentId: student.id, pointsEarned: 100, excused: false })

    // (60*1 + 100*3) / (1+3) = 90
    const composites = getCourseGroupComposite(group.id)
    expect(composites[0].compositePercent).toBe(90)
  })

  it('returns an empty list for a course group with no classes', () => {
    const group = createCourseGroup({ name: 'Empty' })
    expect(getCourseGroupComposite(group.id)).toEqual([])
  })
})
