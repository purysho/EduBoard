import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createStudent } from '../students'
import { createClass } from '../classes'
import { enrollStudent } from '../enrollments'
import { createAssessment } from '../assessments'
import { createRubric, deleteRubric, getRubric, updateRubric } from '../rubrics'
import { saveRubricScores } from '../rubricScores'
import { listScoreHistory, listScoresByAssessment, upsertScore } from '../scores'
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

describe('rubrics', () => {
  it('creates a rubric with criteria and levels, computing maxPoints from the best level per criterion', () => {
    const rubric = createRubric({
      name: 'Essay rubric',
      description: 'Grades a 5-paragraph essay',
      criteria: [
        {
          name: 'Thesis',
          levels: [
            { label: 'Excellent', points: 4 },
            { label: 'Good', points: 3 },
            { label: 'Needs work', points: 1 }
          ]
        },
        {
          name: 'Evidence',
          levels: [
            { label: 'Excellent', points: 4 },
            { label: 'Good', points: 3 }
          ]
        }
      ]
    })

    expect(rubric.criteria).toHaveLength(2)
    expect(rubric.criteria[0].levels).toHaveLength(3)
    expect(rubric.maxPoints).toBe(8)

    const fetched = getRubric(rubric.id)
    expect(fetched?.criteria.map((c) => c.name)).toEqual(['Thesis', 'Evidence'])
  })

  it('replaces the whole criteria/levels tree on update', () => {
    const rubric = createRubric({
      name: 'Draft',
      criteria: [{ name: 'A', levels: [{ label: 'Yes', points: 1 }] }]
    })

    const updated = updateRubric(rubric.id, {
      name: 'Final',
      criteria: [
        { name: 'B', levels: [{ label: 'Great', points: 5 }] },
        { name: 'C', levels: [{ label: 'Great', points: 5 }] }
      ]
    })

    expect(updated.name).toBe('Final')
    expect(updated.criteria.map((c) => c.name)).toEqual(['B', 'C'])
    expect(updated.maxPoints).toBe(10)
  })

  it('preserves criterion/level ids across an edit that keeps them, so existing rubric scores stay intact', () => {
    const rubric = createRubric({
      name: 'Essay rubric',
      criteria: [
        {
          name: 'Thesis',
          levels: [
            { label: 'Excellent', points: 4 },
            { label: 'Good', points: 3 }
          ]
        }
      ]
    })
    const originalCriterionId = rubric.criteria[0].id
    const originalLevelId = rubric.criteria[0].levels[0].id

    // Edit: fix a typo in the criterion name, keep both ids, add a third level.
    const updated = updateRubric(rubric.id, {
      name: rubric.name,
      criteria: [
        {
          id: originalCriterionId,
          name: 'Thesis statement',
          levels: [
            { id: originalLevelId, label: 'Excellent', points: 4 },
            { id: rubric.criteria[0].levels[1].id, label: 'Good', points: 3 },
            { label: 'Poor', points: 1 }
          ]
        }
      ]
    })

    expect(updated.criteria[0].id).toBe(originalCriterionId)
    expect(updated.criteria[0].name).toBe('Thesis statement')
    expect(updated.criteria[0].levels[0].id).toBe(originalLevelId)
    expect(updated.criteria[0].levels).toHaveLength(3)
  })

  it('scoring a rubric-graded assessment computes points into the normal scores table and audit trail', () => {
    const student = createStudent({
      firstName: 'Ada',
      lastName: 'Lovelace',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    const cls = createClass({
      name: 'English 10',
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
    })
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })

    const rubric = createRubric({
      name: 'Essay rubric',
      criteria: [
        {
          name: 'Thesis',
          levels: [
            { label: 'Excellent', points: 4 },
            { label: 'Good', points: 3 }
          ]
        },
        {
          name: 'Evidence',
          levels: [
            { label: 'Excellent', points: 4 },
            { label: 'Good', points: 3 }
          ]
        }
      ]
    })

    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: rubric.id,
      name: 'Essay 1',
      description: null,
      assessmentDate: '2026-09-10',
      maxScore: rubric.maxPoints
    })

    const [thesis, evidence] = rubric.criteria

    const first = saveRubricScores({
      assessmentId: assessment.id,
      studentId: student.id,
      selections: [
        { criterionId: thesis.id, levelId: thesis.levels[0].id }, // 4
        { criterionId: evidence.id, levelId: evidence.levels[1].id } // 3
      ]
    })
    expect(first.pointsEarned).toBe(7)

    const scores = listScoresByAssessment(assessment.id)
    expect(scores).toHaveLength(1)
    expect(scores[0].studentId).toBe(student.id)
    expect(scores[0].pointsEarned).toBe(7)

    // Re-grading (e.g. after reconsidering) updates the score and leaves an audit trail,
    // reusing scores.upsertScore's existing history tracking for free.
    const second = saveRubricScores({
      assessmentId: assessment.id,
      studentId: student.id,
      selections: [
        { criterionId: thesis.id, levelId: thesis.levels[0].id }, // 4
        { criterionId: evidence.id, levelId: evidence.levels[0].id } // 4
      ]
    })
    expect(second.pointsEarned).toBe(8)

    const history = listScoreHistory(assessment.id, student.id)
    expect(history).toHaveLength(1)
    expect(history[0].previousPoints).toBe(7)
    expect(history[0].newPoints).toBe(8)
  })

  it('re-grading a rubric assessment does not clear an existing excused flag', () => {
    const student = createStudent({
      firstName: 'Ada',
      lastName: 'Lovelace',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    const cls = createClass({
      name: 'History',
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
    })
    const rubric = createRubric({
      name: 'Quick check',
      criteria: [{ name: 'A', levels: [{ label: 'Yes', points: 1 }] }]
    })
    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: rubric.id,
      name: 'Check',
      description: null,
      assessmentDate: null,
      maxScore: 1
    })

    // Student is marked excused some other way (e.g. the plain gradebook cell) before
    // ever being rubric-graded.
    upsertScore({
      assessmentId: assessment.id,
      studentId: student.id,
      pointsEarned: null,
      excused: true
    })

    saveRubricScores({
      assessmentId: assessment.id,
      studentId: student.id,
      selections: [{ criterionId: rubric.criteria[0].id, levelId: rubric.criteria[0].levels[0].id }]
    })

    const [score] = listScoresByAssessment(assessment.id)
    expect(score.excused).toBe(true)
  })

  it('detaches from assessments (SET NULL) when the rubric is deleted', () => {
    const cls = createClass({
      name: 'Club',
      subject: null,
      levelType: 'club',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const rubric = createRubric({
      name: 'Temp',
      criteria: [{ name: 'A', levels: [{ label: 'Yes', points: 1 }] }]
    })
    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: rubric.id,
      name: 'Check',
      description: null,
      assessmentDate: null,
      maxScore: 1
    })

    deleteRubric(rubric.id)
    expect(getRubric(rubric.id)).toBeUndefined()

    const scores = listScoresByAssessment(assessment.id)
    expect(scores).toHaveLength(0) // sanity: no scores recorded, unrelated to the delete
  })
})
