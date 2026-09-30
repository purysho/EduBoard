import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import {
  createLessonResource,
  getLessonResource,
  setLessonResourceManualPracticeSet
} from '../lessonResources'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-manual-practice-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('teacher-authored practice sets', () => {
  it('saves manual flashcards as immediately approved', () => {
    const resource = createLessonResource({
      title: 'Speaking prompts',
      type: 'note',
      url: null,
      filePath: null,
      notes: null,
      tags: [],
      standardId: null,
      classId: null,
      shareWithStudents: false,
      studyGuide: null
    })
    setLessonResourceManualPracticeSet(resource.id, 'flashcards', [
      { front: 'Where are you from?', back: 'I am from…' }
    ])
    const saved = getLessonResource(resource.id)!
    expect(saved.flashcards).toEqual([{ front: 'Where are you from?', back: 'I am from…' }])
    expect(saved.aiApproved.flashcards).toBe(true)
  })

  it('saves manual quiz questions as immediately approved and can clear them', () => {
    const resource = createLessonResource({
      title: 'Quick check',
      type: 'note',
      url: null,
      filePath: null,
      notes: null,
      tags: [],
      standardId: null,
      classId: null,
      shareWithStudents: false,
      studyGuide: null
    })
    setLessonResourceManualPracticeSet(resource.id, 'quiz', [
      {
        question: 'Which greeting is formal?',
        options: ['Hey!', 'Good morning.'],
        answerIndex: 1,
        explanation: 'Good morning is the more formal choice.'
      }
    ])
    expect(getLessonResource(resource.id)?.aiApproved.practiceQuiz).toBe(true)
    setLessonResourceManualPracticeSet(resource.id, 'quiz', null)
    expect(getLessonResource(resource.id)?.practiceQuiz).toBeNull()
    expect(getLessonResource(resource.id)?.aiApproved.practiceQuiz).toBe(false)
  })
})
