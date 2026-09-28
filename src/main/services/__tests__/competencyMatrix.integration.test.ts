import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS, type Student } from '@shared/types'
import { createStudent } from '../../repositories/students'
import { createClass } from '../../repositories/classes'
import { enrollStudent } from '../../repositories/enrollments'
import { createStandard } from '../../repositories/standards'
import { createRubric } from '../../repositories/rubrics'
import { createAssessment } from '../../repositories/assessments'
import { saveRubricScores } from '../../repositories/rubricScores'
import { createHomeworkAssignment } from '../../repositories/homeworkAssignments'
import { saveHomeworkRubricScores } from '../../repositories/homeworkRubricScores'
import { getCompetencyMatrix } from '../competencyMatrix'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-competency-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function makeStudent(firstName: string, lastName: string): Student {
  return createStudent({
    firstName,
    lastName,
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  })
}

describe('competency evidence matrix', () => {
  it('shows the latest rubric level from assessment and homework evidence without duplicating mastery data', () => {
    const cls = createClass({
      name: 'Applied English',
      subject: 'English',
      levelType: 'university',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const ada = makeStudent('Ada', 'Lovelace')
    const grace = makeStudent('Grace', 'Hopper')
    enrollStudent({ studentId: ada.id, classId: cls.id, enrolledOn: '2026-09-01' })
    enrollStudent({ studentId: grace.id, classId: cls.id, enrolledOn: '2026-09-01' })

    const speaking = createStandard({
      code: 'ENG-01',
      description: 'Explain an idea clearly.',
      subject: 'English'
    })
    const writing = createStandard({
      code: 'ENG-02',
      description: 'Write for a professional audience.',
      subject: 'English'
    })

    const spokenRubric = createRubric({
      name: 'Speaking',
      criteria: [
        {
          name: 'Clarity',
          standardId: speaking.id,
          levels: [
            { label: 'Emerging', points: 1 },
            { label: 'Strong', points: 4 }
          ]
        }
      ]
    })
    const writtenRubric = createRubric({
      name: 'Writing',
      criteria: [
        {
          name: 'Purpose',
          standardId: writing.id,
          levels: [
            { label: 'Developing', points: 2 },
            { label: 'Secure', points: 3 }
          ]
        }
      ]
    })

    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: spokenRubric.id,
      name: 'Major explainer',
      description: null,
      assessmentDate: '2026-10-01',
      maxScore: spokenRubric.maxPoints
    })
    saveRubricScores({
      assessmentId: assessment.id,
      studentId: ada.id,
      selections: [
        {
          criterionId: spokenRubric.criteria[0].id,
          levelId: spokenRubric.criteria[0].levels[1].id
        }
      ]
    })

    const homework = createHomeworkAssignment({
      classId: cls.id,
      title: 'Professional email',
      description: null,
      dueDate: '2026-10-08',
      filePath: null,
      fileName: null,
      topic: 'Writing',
      status: 'draft',
      rubricId: writtenRubric.id
    })
    saveHomeworkRubricScores(
      {
        homeworkAssignmentId: homework.id,
        studentId: ada.id,
        selections: [
          {
            criterionId: writtenRubric.criteria[0].id,
            levelId: writtenRubric.criteria[0].levels[0].id
          }
        ]
      },
      writtenRubric.id
    )

    const matrix = getCompetencyMatrix(cls.id)

    expect(matrix.standards.map((standard) => standard.code)).toEqual(['ENG-01', 'ENG-02'])
    expect(matrix.students.map((student) => student.name)).toEqual(['Ada Lovelace', 'Grace Hopper'])

    const cell = (studentId: string, standardId: string) =>
      matrix.cells.find((item) => item.studentId === studentId && item.standardId === standardId)

    expect(cell(ada.id, speaking.id)).toMatchObject({
      latestLevelLabels: ['Strong'],
      latestLevelLabel: 'Strong',
      latestEvidenceMixed: false,
      latestSourceType: 'assessment',
      latestSourceName: 'Major explainer',
      evidenceCount: 1
    })
    expect(cell(ada.id, writing.id)).toMatchObject({
      latestLevelLabels: ['Developing'],
      latestLevelLabel: 'Developing',
      latestEvidenceMixed: false,
      latestSourceType: 'homework',
      latestSourceName: 'Professional email',
      evidenceCount: 1
    })
    expect(cell(grace.id, speaking.id)).toMatchObject({
      latestLevelLabels: [],
      latestLevelLabel: null,
      latestEvidenceMixed: false,
      latestSourceType: null,
      evidenceCount: 0
    })
  })

  it('marks the newest evidence as mixed when one assessment has different levels for the same standard', () => {
    const cls = createClass({
      name: 'Presentation class',
      subject: 'English',
      levelType: 'university',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const student = makeStudent('Mei', 'Chen')
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })
    const standard = createStandard({
      code: 'PRES-01',
      description: 'Present clearly.',
      subject: 'English'
    })
    const rubric = createRubric({
      name: 'Presentation evidence',
      criteria: [
        {
          name: 'Message',
          standardId: standard.id,
          levels: [
            { label: 'Developing', points: 2 },
            { label: 'Secure', points: 3 }
          ]
        },
        {
          name: 'Delivery',
          standardId: standard.id,
          levels: [
            { label: 'Developing', points: 2 },
            { label: 'Secure', points: 3 }
          ]
        }
      ]
    })
    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: rubric.id,
      name: 'Presentation 1',
      description: null,
      assessmentDate: '2026-10-10',
      maxScore: rubric.maxPoints
    })

    saveRubricScores({
      assessmentId: assessment.id,
      studentId: student.id,
      selections: [
        { criterionId: rubric.criteria[0].id, levelId: rubric.criteria[0].levels[1].id },
        { criterionId: rubric.criteria[1].id, levelId: rubric.criteria[1].levels[0].id }
      ]
    })

    const cell = getCompetencyMatrix(cls.id).cells[0]
    expect(cell).toMatchObject({
      latestLevelLabel: null,
      latestEvidenceMixed: true,
      latestSourceType: 'assessment',
      latestSourceName: 'Presentation 1',
      evidenceCount: 2
    })
    expect(new Set(cell.latestLevelLabels)).toEqual(new Set(['Secure', 'Developing']))
  })

  it('reflects re-grading immediately because rubric selections remain the source of truth', () => {
    const cls = createClass({
      name: 'Seminar',
      subject: 'English',
      levelType: 'university',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const student = makeStudent('Lin', 'Wei')
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })
    const standard = createStandard({
      code: 'DISC-01',
      description: 'Participate in discussion.',
      subject: 'English'
    })
    const rubric = createRubric({
      name: 'Discussion',
      criteria: [
        {
          name: 'Interaction',
          standardId: standard.id,
          levels: [
            { label: 'Emerging', points: 1 },
            { label: 'Secure', points: 3 }
          ]
        }
      ]
    })
    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: rubric.id,
      name: 'Discussion 1',
      description: null,
      assessmentDate: null,
      maxScore: rubric.maxPoints
    })

    saveRubricScores({
      assessmentId: assessment.id,
      studentId: student.id,
      selections: [{ criterionId: rubric.criteria[0].id, levelId: rubric.criteria[0].levels[0].id }]
    })
    expect(getCompetencyMatrix(cls.id).cells[0].latestLevelLabel).toBe('Emerging')

    saveRubricScores({
      assessmentId: assessment.id,
      studentId: student.id,
      selections: [{ criterionId: rubric.criteria[0].id, levelId: rubric.criteria[0].levels[1].id }]
    })
    expect(getCompetencyMatrix(cls.id).cells[0].latestLevelLabel).toBe('Secure')
    expect(getCompetencyMatrix(cls.id).cells[0].evidenceCount).toBe(1)
  })
})
