import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { createRubric } from '../../repositories/rubrics'
import { saveRubricScores } from '../../repositories/rubricScores'
import { portalAssessmentsForClass } from '../portalAssessments'
import { DEFAULT_GRADE_THRESHOLDS, type PortalScoreOptions } from '@shared/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-portal-assessments-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const DEFAULTS: PortalScoreOptions = { assessments: true, comments: false, classAverage: false }

function setUp(studentCount: number): { classId: string; students: string[] } {
  const classId = createClass({
    name: 'Maths',
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
  const students = Array.from({ length: studentCount }, (_, i) => {
    const id = createStudent({
      firstName: `Student${i}`,
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
    return id
  })
  return { classId, students }
}

function quiz(classId: string, name: string, date: string, maxScore = 20): string {
  return createAssessment({
    classId,
    categoryId: null,
    name,
    description: null,
    assessmentDate: date,
    maxScore
  }).id
}

describe('assessments published to the Portal', () => {
  it("sends only marked assessments and only these students' own scores", () => {
    const { classId, students } = setUp(3)
    const [ada, ben, cai] = students
    const later = quiz(classId, 'Algebra test', '2026-10-01')
    const earlier = quiz(classId, 'Fractions quiz', '2026-09-15')
    quiz(classId, 'Set up ahead', '2026-12-01')
    upsertScore({ assessmentId: earlier, studentId: ada, pointsEarned: 17, late: true })
    upsertScore({ assessmentId: later, studentId: ada, pointsEarned: null, excused: true })
    upsertScore({ assessmentId: earlier, studentId: cai, pointsEarned: 12 })

    const out = portalAssessmentsForClass(classId, new Set([ada, ben]), DEFAULTS)
    // Oldest first; the unmarked one stays private.
    expect(out.assessments.map((a) => a.name)).toEqual(['Fractions quiz', 'Algebra test'])
    // Cai isn't in the set (e.g. no longer active), so neither their score is sent…
    expect(out.scores.every((s) => s.studentId !== cai)).toBe(true)
    expect(out.scores).toHaveLength(2)
    expect(out.scores.find((s) => s.assessmentId === earlier)).toMatchObject({
      points: 17,
      late: true,
      excused: false,
      rubric: null
    })
    expect(out.scores.find((s) => s.assessmentId === later)).toMatchObject({
      points: null,
      excused: true
    })
  })

  it('keeps comments private and the class average hidden unless turned on', () => {
    const { classId, students } = setUp(5)
    const id = quiz(classId, 'Quiz', '2026-09-15', 10)
    students.slice(0, 4).forEach((s, i) =>
      upsertScore({
        assessmentId: id,
        studentId: s,
        pointsEarned: 6 + i,
        comment: i === 0 ? '  Talk to mum about retake  ' : null
      })
    )
    const all = new Set(students)
    const hidden = portalAssessmentsForClass(classId, all, DEFAULTS)
    expect(hidden.scores.every((s) => s.comment === null)).toBe(true)
    expect(hidden.assessments[0].classAverage).toBeNull()

    const shown = { assessments: true, comments: true, classAverage: true }
    // Only four scores: too few for an average anyone could work back from.
    const four = portalAssessmentsForClass(classId, all, shown)
    expect(four.assessments[0].classAverage).toBeNull()
    expect(four.scores.find((s) => s.studentId === students[0])?.comment).toBe(
      'Talk to mum about retake'
    )

    upsertScore({ assessmentId: id, studentId: students[4], pointsEarned: 10 })
    const five = portalAssessmentsForClass(classId, all, shown)
    // (6 + 7 + 8 + 9 + 10) / 5 = 8 out of 10.
    expect(five.assessments[0].classAverage).toBe(80)
  })

  it('sends the rubric level reached on each criterion', () => {
    const { classId, students } = setUp(1)
    const rubric = createRubric({
      name: 'Essay',
      criteria: [
        {
          name: 'Ideas',
          levels: [
            { label: 'Developing', points: 1 },
            { label: 'Secure', points: 3 }
          ]
        },
        {
          name: 'Spelling',
          levels: [
            { label: 'Developing', points: 1 },
            { label: 'Secure', points: 2 }
          ]
        }
      ]
    })
    const essay = createAssessment({
      classId,
      categoryId: null,
      rubricId: rubric.id,
      name: 'Essay',
      description: null,
      assessmentDate: '2026-09-20',
      maxScore: 5
    }).id
    const [ideas, spelling] = rubric.criteria
    saveRubricScores({
      assessmentId: essay,
      studentId: students[0],
      selections: [
        { criterionId: ideas.id, levelId: ideas.levels[1].id },
        { criterionId: spelling.id, levelId: spelling.levels[0].id }
      ]
    })
    const out = portalAssessmentsForClass(classId, new Set(students), DEFAULTS)
    expect(out.scores[0].points).toBe(4)
    expect(out.scores[0].rubric).toEqual([
      { criterion: 'Ideas', level: 'Secure', points: 3, maxPoints: 3 },
      { criterion: 'Spelling', level: 'Developing', points: 1, maxPoints: 2 }
    ])
  })

  it('sends nothing when the teacher turned assessment scores off', () => {
    const { classId, students } = setUp(1)
    upsertScore({
      assessmentId: quiz(classId, 'Quiz', '2026-09-15'),
      studentId: students[0],
      pointsEarned: 15
    })
    expect(
      portalAssessmentsForClass(classId, new Set(students), { ...DEFAULTS, assessments: false })
    ).toEqual({ assessments: [], scores: [] })
  })
})
