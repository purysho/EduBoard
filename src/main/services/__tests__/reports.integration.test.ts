import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createStudent } from '../../repositories/students'
import { createClass } from '../../repositories/classes'
import { createGradeCategory } from '../../repositories/gradeCategories'
import { enrollStudent } from '../../repositories/enrollments'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { markAttendance } from '../../repositories/attendanceRecords'
import { createLessonPlan } from '../../repositories/lessonPlans'
import { getClassReport, getClassRoster, getDashboardStats } from '../reports'
import { DEFAULT_GRADE_THRESHOLDS, type ClassSection, type Student } from '@shared/types'

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

function setUpClassWithOneStudent(): { student: Student; cls: ClassSection } {
  const student = createStudent({
    firstName: 'Ada',
    lastName: 'Lovelace',
    preferredName: null,
    studentNumber: 'S001',
    dateOfBirth: null,
    gradeLevel: 'Grade 10',
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  })

  const cls = createClass({
    name: 'English 10',
    subject: 'English',
    levelType: 'k12',
    gradeLevel: 'Grade 10',
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  })

  enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })

  const homework = createGradeCategory({
    classId: cls.id,
    name: 'Homework',
    weightPercent: 40,
    sortOrder: 0
  })
  const exams = createGradeCategory({
    classId: cls.id,
    name: 'Exams',
    weightPercent: 60,
    sortOrder: 1
  })

  const a1 = createAssessment({
    classId: cls.id,
    categoryId: homework.id,
    name: 'HW1',
    description: null,
    assessmentDate: '2026-09-05',
    maxScore: 100
  })
  const a2 = createAssessment({
    classId: cls.id,
    categoryId: exams.id,
    name: 'Midterm',
    description: null,
    assessmentDate: '2026-10-01',
    maxScore: 100
  })

  upsertScore({ assessmentId: a1.id, studentId: student.id, pointsEarned: 90 })
  upsertScore({ assessmentId: a2.id, studentId: student.id, pointsEarned: 70 })

  markAttendance({ classId: cls.id, studentId: student.id, date: '2026-09-01', status: 'present' })
  markAttendance({ classId: cls.id, studentId: student.id, date: '2026-09-02', status: 'absent' })

  createLessonPlan({
    classId: cls.id,
    date: '2099-01-01',
    weekLabel: 'Week 1',
    title: 'Intro',
    objectives: null,
    framework: null,
    materials: null,
    activities: null,
    homework: null,
    linkedAssessmentId: null,
    standards: null
  })

  return { student, cls }
}

describe('reports service (end-to-end through sqlite)', () => {
  it('computes a weighted class grade for the roster', () => {
    const { student, cls } = setUpClassWithOneStudent()
    const roster = getClassRoster(cls.id)
    expect(roster).toHaveLength(1)
    const row = roster[0]
    expect(row.student.id).toBe(student.id)
    // 90*0.4 + 70*0.6 = 78
    expect(row.grade.percent).toBeCloseTo(78, 5)
    expect(row.grade.letter).toBe('C')
    expect(row.attendanceRate).toBe(0.5)
  })

  it('builds a class report with distribution and attendance trend', () => {
    const { cls } = setUpClassWithOneStudent()
    const report = getClassReport(cls.id)
    expect(report).not.toBeNull()
    expect(report!.averagePercent).toBeCloseTo(78, 5)
    expect(report!.passRate).toBe(1)
    expect(report!.gradeDistribution.find((g) => g.letter === 'C')?.count).toBe(1)
    expect(report!.attendanceTrend).toHaveLength(2)
    expect(report!.categoryAverages).toHaveLength(2)
  })

  it('rolls class data up into dashboard stats', () => {
    setUpClassWithOneStudent()
    const stats = getDashboardStats()
    expect(stats.classCount).toBe(1)
    expect(stats.studentCount).toBe(1)
    expect(stats.activeEnrollmentCount).toBe(1)
    expect(stats.averagePercent).toBeCloseTo(78, 5)
    expect(stats.passRate).toBe(1)
    expect(stats.upcomingLessons).toHaveLength(1)
  })
})
