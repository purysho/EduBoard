import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getSqlite, initDb, setDbPathForTesting } from '../../db/client'
import { runMigrations } from '../../db/migrations'
import {
  createLessonResource,
  getLessonResource,
  setLessonResourceAiApproval,
  setLessonResourcePracticeSet,
  setLessonResourceStudyGuide,
  updateLessonResource
} from '../lessonResources'
import { replaceResourceChunks, searchResourceChunks } from '../resourceChunks'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-ai-approval-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const newResource = (): string =>
  createLessonResource({
    title: 'Photosynthesis',
    type: 'note',
    url: null,
    filePath: null,
    notes: null,
    tags: [],
    standardId: null,
    classId: null,
    shareWithStudents: false,
    studyGuide: null
  }).id

describe('AI study materials wait for the teacher', () => {
  it('a new draft is unchecked until approved, and a regenerated one needs checking again', () => {
    const id = newResource()
    setLessonResourceStudyGuide(id, 'In short: plants make food from light.')
    expect(getLessonResource(id)?.aiApproved.studyGuide).toBe(false)

    setLessonResourceAiApproval(id, 'studyGuide', true)
    expect(getLessonResource(id)?.aiApproved.studyGuide).toBe(true)

    setLessonResourceStudyGuide(id, 'A new version.')
    expect(getLessonResource(id)?.aiApproved.studyGuide).toBe(false)

    const cards = Array.from({ length: 8 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` }))
    setLessonResourcePracticeSet(id, 'flashcards', cards)
    setLessonResourceAiApproval(id, 'flashcards', true)
    expect(getLessonResource(id)?.aiApproved).toMatchObject({
      studyGuide: false,
      flashcards: true
    })
  })

  it('nothing that doesn’t exist can be approved', () => {
    const id = newResource()
    setLessonResourceAiApproval(id, 'practiceQuiz', true)
    expect(getLessonResource(id)?.aiApproved.practiceQuiz).toBe(false)
  })

  it('a guide the teacher edits by hand counts as checked; saving it unchanged does not', () => {
    const id = newResource()
    setLessonResourceStudyGuide(id, 'Draft')
    updateLessonResource(id, { title: 'Renamed', studyGuide: 'Draft' })
    expect(getLessonResource(id)?.aiApproved.studyGuide).toBe(false)
    updateLessonResource(id, { studyGuide: 'Draft, corrected by the teacher' })
    expect(getLessonResource(id)?.aiApproved.studyGuide).toBe(true)
  })
})

describe('Notebook search', () => {
  it('finds Chinese text from a Chinese question, and English as before', () => {
    const zh = newResource()
    const en = newResource()
    replaceResourceChunks(zh, ['光合作用是植物利用阳光把二氧化碳和水变成葡萄糖的过程。'])
    replaceResourceChunks(en, ['Photosynthesis turns light into chemical energy.'])
    expect(searchResourceChunks('什么是光合作用？', null, 5).map((m) => m.resourceId)).toEqual([zh])
    expect(
      searchResourceChunks('what is photosynthesis?', null, 5).map((m) => m.resourceId)
    ).toEqual([en])
    // The text comes back as written, without the search index's spacing.
    expect(searchResourceChunks('葡萄糖', null, 5)[0].text).toBe(
      '光合作用是植物利用阳光把二氧化碳和水变成葡萄糖的过程。'
    )
    expect(searchResourceChunks('"; DROP TABLE x --', null, 5)).toEqual([])
  })
})

describe('upgrading an older database', () => {
  it('keeps already-published AI material published and rebuilds search for Chinese', () => {
    const id = newResource()
    const db = getSqlite()
    // Back to how it was before these two migrations, with a published guide and text.
    db.exec(`
      ALTER TABLE lesson_resources DROP COLUMN ai_approved;
      DROP TABLE resource_chunks;
      CREATE VIRTUAL TABLE resource_chunks USING fts5(resource_id UNINDEXED, chunk_index UNINDEXED, text);
      DELETE FROM _migrations WHERE id IN (35, 36);
    `)
    db.prepare("UPDATE lesson_resources SET study_guide = 'Published guide' WHERE id = ?").run(id)
    db.prepare('INSERT INTO resource_chunks (resource_id, chunk_index, text) VALUES (?, 0, ?)').run(
      id,
      '细胞是生物体的基本单位。'
    )

    runMigrations(db)

    expect(getLessonResource(id)?.aiApproved).toEqual({
      studyGuide: true,
      flashcards: false,
      practiceQuiz: false
    })
    expect(searchResourceChunks('细胞', null, 5).map((m) => m.text)).toEqual([
      '细胞是生物体的基本单位。'
    ])
  })
})
