import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import * as classesRepo from '../../repositories/classes'
import * as homeworkRepo from '../../repositories/homeworkAssignments'
import * as homeworkQuestionsRepo from '../../repositories/homeworkQuestions'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { copyHomeworkToClasses } from '../homeworkCopy'

let dir: string

function makeClass(name: string) {
  return classesRepo.createClass({
    name,
    subject: 'English',
    levelType: 'k12',
    gradeLevel: '5',
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-homework-copy-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('copyHomeworkToClasses', () => {
  it('copies reusable assignment content and quick-check questions as a fresh draft', () => {
    const sourceClass = makeClass('5A')
    const targetClass = makeClass('5B')
    const source = homeworkRepo.createHomeworkAssignment({
      classId: sourceClass.id,
      title: 'Museum review',
      description: 'Complete the review.',
      dueDate: '2026-10-05',
      filePath: '/tmp/review.pdf',
      fileName: 'review.pdf',
      topic: 'Museums',
      status: 'published',
      rubricId: null
    })
    homeworkQuestionsRepo.replaceHomeworkQuestions(source.id, [
      {
        type: 'multiple_choice',
        prompt: 'Which word means something shown in a museum?',
        options: ['exhibit', 'alarm'],
        correctAnswer: '0',
        points: 1
      }
    ])

    const [copy] = copyHomeworkToClasses(source.id, [targetClass.id, targetClass.id])

    expect(copy.classId).toBe(targetClass.id)
    expect(copy.status).toBe('draft')
    expect(copy.dueDate).toBeNull()
    expect(copy.fileName).toBe('review.pdf')
    expect(copy.topic).toBe('Museums')
    expect(homeworkQuestionsRepo.listHomeworkQuestions(copy.id)).toMatchObject([
      {
        prompt: 'Which word means something shown in a museum?',
        correctAnswer: '0',
        points: 1
      }
    ])
  })

  it('rejects archived target classes', () => {
    const sourceClass = makeClass('5A')
    const targetClass = makeClass('5B')
    classesRepo.updateClass(targetClass.id, { archived: true })
    const source = homeworkRepo.createHomeworkAssignment({
      classId: sourceClass.id,
      title: 'Review',
      description: null,
      dueDate: null,
      filePath: null,
      fileName: null,
      topic: null,
      status: 'draft',
      rubricId: null
    })

    expect(() => copyHomeworkToClasses(source.id, [targetClass.id])).toThrow(/no longer active/i)
  })
})
