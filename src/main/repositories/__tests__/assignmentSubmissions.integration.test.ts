import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../classes'
import { createAssessment } from '../assessments'
import { createStudent } from '../students'
import {
  deleteAssignmentSubmission,
  listSubmissionsByAssessment,
  listSubmissionsByClass,
  upsertAssignmentSubmission
} from '../assignmentSubmissions'
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

function makeClass(): string {
  return createClass({
    name: 'Grade 5',
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
}

function makeAssessment(classId: string, name = 'Essay'): string {
  return createAssessment({
    classId,
    categoryId: null,
    name,
    description: null,
    assessmentDate: null,
    maxScore: 100
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

describe('assignment submissions', () => {
  it('creates a submission and replaces it in place on resubmission', () => {
    const classId = makeClass()
    const assessmentId = makeAssessment(classId)
    const studentId = makeStudent('Ana')

    const first = upsertAssignmentSubmission({
      assessmentId,
      studentId,
      filePath: '/home/ana/essay-v1.docx',
      fileName: 'essay-v1.docx'
    })
    expect(listSubmissionsByAssessment(assessmentId)).toHaveLength(1)

    const second = upsertAssignmentSubmission({
      assessmentId,
      studentId,
      filePath: '/home/ana/essay-v2.docx',
      fileName: 'essay-v2.docx'
    })

    expect(second.id).toBe(first.id)
    const rows = listSubmissionsByAssessment(assessmentId)
    expect(rows).toHaveLength(1)
    expect(rows[0].fileName).toBe('essay-v2.docx')
  })

  it('lists submissions across every assessment in a class in one call', () => {
    const classId = makeClass()
    const essayId = makeAssessment(classId, 'Essay')
    const quizId = makeAssessment(classId, 'Quiz')
    const otherClassId = makeClass()
    const otherAssessmentId = makeAssessment(otherClassId, 'Unrelated')

    const student1 = makeStudent('Ben')
    const student2 = makeStudent('Cid')

    upsertAssignmentSubmission({
      assessmentId: essayId,
      studentId: student1,
      filePath: '/a.pdf',
      fileName: 'a.pdf'
    })
    upsertAssignmentSubmission({
      assessmentId: quizId,
      studentId: student2,
      filePath: '/b.pdf',
      fileName: 'b.pdf'
    })
    upsertAssignmentSubmission({
      assessmentId: otherAssessmentId,
      studentId: student1,
      filePath: '/c.pdf',
      fileName: 'c.pdf'
    })

    const classSubmissions = listSubmissionsByClass(classId)
    expect(classSubmissions).toHaveLength(2)
    expect(classSubmissions.map((s) => s.fileName).sort()).toEqual(['a.pdf', 'b.pdf'])
  })

  it('deletes a submission', () => {
    const classId = makeClass()
    const assessmentId = makeAssessment(classId)
    const studentId = makeStudent('Dee')

    const submission = upsertAssignmentSubmission({
      assessmentId,
      studentId,
      filePath: '/d.pdf',
      fileName: 'd.pdf'
    })
    deleteAssignmentSubmission(submission.id)
    expect(listSubmissionsByAssessment(assessmentId)).toHaveLength(0)
  })

  it('returns an empty list for a class with no assessments', () => {
    const classId = makeClass()
    expect(listSubmissionsByClass(classId)).toEqual([])
  })
})
