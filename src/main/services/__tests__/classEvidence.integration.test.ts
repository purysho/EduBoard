import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createLessonPlan } from '../../repositories/lessonPlans'
import { upsertLessonEvidence } from '../../repositories/lessonEvidence'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import {
  setExitTicketOpen,
  submitExitTicketResponse,
  upsertExitTicket
} from '../../repositories/exitTickets'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { addDays } from '@shared/dates'
import { classEvidenceFor } from '../classEvidence'
import { localDateIso } from '../today'
import { buildLessonPlanPrompt } from '../lessonDraftPrompt'
import { EMPTY_CLASS_AI_PROFILE } from '@shared/classAiProfile'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-class-evidence-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

function lesson(classId: string, date: string, title: string): string {
  return createLessonPlan({
    classId,
    date,
    weekLabel: null,
    title,
    objectives: `Aim of ${title}`,
    framework: null,
    materials: null,
    activities: null,
    homework: null,
    linkedAssessmentId: null,
    standards: null
  }).id
}

describe('class evidence for lesson drafts', () => {
  // Today, as the app asks: exit-ticket answers below are stamped with the real time.
  const today = localDateIso(new Date())

  it('summarises recent lessons, ladder steps, assessments and re-teach signals without names', () => {
    const classId = createClass({
      name: 'English 1',
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
    }).id
    const students = ['Quillon', 'Mai', 'Wei', 'Lan'].map((firstName) => {
      const id = createStudent({
        firstName,
        lastName: 'Tester',
        preferredName: null,
        studentNumber: null,
        dateOfBirth: null,
        gradeLevel: null,
        guardianName: null,
        guardianContact: null,
        email: null,
        notes: null
      }).id
      enrollStudent({ studentId: id, classId, enrolledOn: addDays(today, -30) })
      return id
    })

    lesson(classId, addDays(today, -10), 'Old lesson')
    lesson(classId, addDays(today, -8), 'First contact')
    const ladderLesson = lesson(classId, addDays(today, -3), 'Keeping a conversation alive')
    lesson(classId, today, 'University life')
    lesson(classId, addDays(today, 1), 'Future lesson')
    ;(['1', '2', '3', 'M'] as const).forEach((value, i) =>
      upsertLessonEvidence({ lessonPlanId: ladderLesson, studentId: students[i], value })
    )

    const gate = createAssessment({
      classId,
      categoryId: null,
      name: 'Gate 1',
      description: null,
      assessmentDate: addDays(today, -2),
      maxScore: 20
    })
    ;[8, 10, 12].forEach((points, i) =>
      upsertScore({ assessmentId: gate.id, studentId: students[i], pointsEarned: points })
    )
    const tooFew = createAssessment({
      classId,
      categoryId: null,
      name: 'Barely marked',
      description: null,
      assessmentDate: addDays(today, -2),
      maxScore: 10
    })
    upsertScore({ assessmentId: tooFew.id, studentId: students[0], pointsEarned: 1 })

    const ticket = upsertExitTicket({
      classId,
      title: 'Check',
      questions: [
        {
          id: 'q1',
          prompt: 'How do you ask for clarification?',
          type: 'choice',
          options: ['Could you say that again?', 'No idea'],
          goodOptions: [0]
        }
      ]
    })
    setExitTicketOpen(ticket.id, true)
    ;['No idea', 'No idea', 'Could you say that again?'].forEach((answer, i) =>
      submitExitTicketResponse({
        exitTicketId: ticket.id,
        studentName: `Student ${i}`,
        studentId: students[i],
        answers: { q1: answer }
      })
    )

    const evidence = classEvidenceFor(classId, today)

    expect(evidence.recentLessons.map((l) => l.title)).toEqual([
      'First contact',
      'Keeping a conversation alive',
      'University life'
    ])
    expect(evidence.ladder).toEqual([
      {
        date: addDays(today, -3),
        title: 'Keeping a conversation alive',
        marked: 4,
        median: 2,
        atLeast3: 1,
        complete: 0,
        missing: 1
      }
    ])
    expect(evidence.assessments).toEqual([{ name: 'Gate 1', average: 50, scored: 3 }])
    expect(evidence.reteach).toEqual([
      { prompt: 'How do you ask for clarification?', understood: 33 }
    ])

    const { user } = buildLessonPlanPrompt(
      { className: 'English 1', subject: 'English', gradeLevel: null, topic: 'Clarifying' },
      { profile: EMPTY_CLASS_AI_PROFILE, evidence },
      ''
    )
    expect(user).toContain(
      'Keeping a conversation alive: 4 marked, median step 2, 1 reached step 3+, 1 missing'
    )
    expect(user).toContain('- Gate 1: 50% (3 scored)')
    expect(user).toContain('"How do you ask for clarification?": 33% understood')
    for (const name of ['Quillon', 'Mai', 'Wei', 'Lan', 'Tester']) expect(user).not.toContain(name)
  })
})
