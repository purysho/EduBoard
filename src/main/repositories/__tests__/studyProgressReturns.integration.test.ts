import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createLessonResource } from '../lessonResources'
import { importStudyProgressReturn, listStudyProgressReturns } from '../studyProgressReturns'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-study-progress-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('offline study progress returns', () => {
  it('stores one return per resource/name/export time and deduplicates re-imports', () => {
    const resource = createLessonResource({
      title: 'Museum vocabulary',
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
    const progress = {
      format: 'eduboard-study-progress' as const,
      version: 1 as const,
      resourceId: resource.id,
      resourceTitle: resource.title,
      studentName: 'Ada Lovelace',
      exportedAt: '2026-10-01T06:00:00.000Z',
      cards: { got: 5, again: 1, total: 6 },
      quiz: { correct: 3, answered: 4, total: 5 }
    }

    const first = importStudyProgressReturn(progress, null)
    const second = importStudyProgressReturn(progress, null)

    expect(second.id).toBe(first.id)
    const rows = listStudyProgressReturns(resource.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].quiz.correct).toBe(3)
    expect(rows[0].cards.got).toBe(5)
  })
})
