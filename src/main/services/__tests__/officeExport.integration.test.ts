import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createLessonPlan } from '../../repositories/lessonPlans'
import {
  createLessonResource,
  setLessonResourceManualPracticeSet
} from '../../repositories/lessonResources'
import { setReportComment } from '../../repositories/reportComments'
import {
  lessonPlanPptx,
  lettersDocx,
  newsletterDocx,
  reportCardsDocx,
  resourcePracticePptx,
  resourceWorksheetDocx
} from '../officeExport'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-office-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function textOf(buffer: Buffer, pattern: RegExp): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const parts = Object.keys(zip.files)
    .filter((f) => pattern.test(f))
    .sort()
  const xml = (await Promise.all(parts.map((f) => zip.file(f)!.async('string')))).join('\n')
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

function setUp(): string {
  const cls = createClass({
    name: 'Grade 4 English',
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
  for (const [first, guardian] of [
    ['Mai', 'Mrs Chen'],
    ['Leo', null]
  ] as const) {
    const s = createStudent({
      firstName: first,
      lastName: 'Chen',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: guardian,
      guardianContact: null,
      email: null,
      notes: null
    })
    enrollStudent({ studentId: s.id, classId: cls, enrolledOn: '2026-09-01' })
    if (first === 'Mai') setReportComment(cls, s.id, 'Mai reads every night.')
  }
  return cls
}

describe('Word and PowerPoint files', () => {
  it('writes a parent letter per student, filled in', async () => {
    const text = await textOf(await lettersDocx(setUp()), /word\/document\.xml/)
    expect(text).toContain('Dear Mrs Chen')
    expect(text).toContain('Dear Parent or guardian of Leo')
    expect(text).toContain('progress in Grade 4 English')
  })

  it('writes every report card with its comment', async () => {
    const text = await textOf(await reportCardsDocx(setUp()), /word\/document\.xml/)
    expect(text).toContain('Mai Chen')
    expect(text).toContain('Leo Chen')
    expect(text).toContain('Mai reads every night.')
  })

  it('turns a newsletter’s headings and bullets into Word headings and a list', async () => {
    const text = await textOf(
      await newsletterDocx('# This week\n- We read books\n\nA short note.'),
      /word\/document\.xml/
    )
    expect(text).toContain('This week')
    expect(text).toContain('We read books')
    expect(text).toContain('A short note.')
  })

  it('exports teacher-authored practice as a worksheet and projector deck', async () => {
    const resource = createLessonResource({
      title: 'Museum vocabulary',
      type: 'note',
      url: null,
      filePath: null,
      notes: 'Write short answers.',
      tags: [],
      standardId: null,
      classId: null,
      shareWithStudents: false,
      studyGuide: 'Review exhibit and ancient.'
    })
    setLessonResourceManualPracticeSet(resource.id, 'flashcards', [
      { front: 'Exhibit', back: 'Something shown in a museum.' }
    ])
    setLessonResourceManualPracticeSet(resource.id, 'quiz', [
      {
        question: 'What does ancient mean?',
        options: ['Very old', 'Very noisy'],
        answerIndex: 0,
        explanation: 'Ancient means very old.'
      }
    ])

    const worksheet = await textOf(await resourceWorksheetDocx(resource.id), /word\/document\.xml/)
    expect(worksheet).toContain('Museum vocabulary')
    expect(worksheet).toContain('Exhibit')
    expect(worksheet).toContain('Answer key')
    expect(worksheet).toContain('Very old')

    const deck = await resourcePracticePptx(resource.id)
    const deckText = await textOf(deck, /ppt\/slides\/slide\d+\.xml$/)
    expect(deckText).toContain('Museum vocabulary')
    expect(deckText).toContain('Exhibit')
    expect(deckText).toContain('What does ancient mean?')
    expect(deckText).toContain('Something shown in a museum.')
  })

  it('makes a slide per activity from a lesson plan', async () => {
    const cls = setUp()
    const plan = createLessonPlan({
      classId: cls,
      date: '2026-09-28',
      weekLabel: null,
      title: 'Animals',
      objectives: '- Name ten animals',
      framework: null,
      materials: null,
      activities: '- Warm-up: animal sounds\n- Pair work: guess the animal',
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    const buffer = await lessonPlanPptx(plan.id)
    const zip = await JSZip.loadAsync(buffer)
    const slides = Object.keys(zip.files).filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f))
    expect(slides).toHaveLength(4) // title, objectives, two activities
    const text = await textOf(buffer, /ppt\/slides\/slide\d+\.xml$/)
    expect(text).toContain('Animals')
    expect(text).toContain('Pair work')
    expect(text).toContain('guess the animal')
  })
})
