import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createLessonPlan, linkLessonResource } from '../../repositories/lessonPlans'
import {
  createLessonResource,
  setLessonResourceAiApproval,
  setLessonResourcePracticeSet
} from '../../repositories/lessonResources'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { offlineLessonPackZip } from '../offlineLessonPack'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-offline-pack-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('offline lesson pack', () => {
  it('bundles the lesson, shared study page and local source file', async () => {
    const cls = createClass({
      name: 'University English',
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
    const lesson = createLessonPlan({
      classId: cls.id,
      date: '2026-10-08',
      weekLabel: 'Week 1',
      title: 'Introductions',
      objectives: 'Introduce yourself clearly.',
      framework: null,
      materials: null,
      activities: 'Talk to a partner.',
      homework: 'Practise again.',
      linkedAssessmentId: null,
      standards: null
    })
    const sourcePath = join(dir, 'listening.txt')
    writeFileSync(sourcePath, 'offline source')
    const resource = createLessonResource({
      title: 'Useful phrases',
      type: 'file',
      url: null,
      filePath: sourcePath,
      notes: 'Review before class.',
      tags: ['speaking'],
      standardId: null,
      classId: cls.id,
      shareWithStudents: true,
      studyGuide: 'Use short clear sentences.'
    })
    setLessonResourcePracticeSet(resource.id, 'flashcards', [
      { front: 'Nice to meet you.', back: 'A polite phrase when meeting someone.' },
      { front: 'I am from…', back: 'A frame for saying where you come from.' },
      { front: 'I study…', back: 'A frame for saying your major.' },
      { front: 'In my free time…', back: 'A frame for talking about interests.' }
    ])
    setLessonResourceAiApproval(resource.id, 'studyGuide', true)
    setLessonResourceAiApproval(resource.id, 'flashcards', true)
    linkLessonResource(lesson.id, resource.id)

    const result = await offlineLessonPackZip(lesson.id)
    expect(result.resources).toBe(1)
    expect(result.files).toBe(1)

    const zip = await JSZip.loadAsync(result.buffer)
    const names = Object.keys(zip.files)
    expect(names).toContain('index.html')
    expect(names.some((name) => name.startsWith('resources/') && name.endsWith('.html'))).toBe(true)
    expect(names.some((name) => name.startsWith('files/') && name.endsWith('.txt'))).toBe(true)

    const index = await zip.file('index.html')!.async('string')
    expect(index).toContain('Introductions')
    expect(index).toContain('Talk to a partner.')
    expect(index).toContain('Useful phrases')

    const studyName = names.find((name) => name.startsWith('resources/') && name.endsWith('.html'))!
    const study = await zip.file(studyName)!.async('string')
    expect(study).toContain('Use short clear sentences.')
    expect(study).toContain('Nice to meet you.')

    const fileName = names.find((name) => name.startsWith('files/') && name.endsWith('.txt'))!
    expect(await zip.file(fileName)!.async('string')).toBe('offline source')
  })

  it('does not include resources the teacher did not share with students', async () => {
    const cls = createClass({
      name: 'Private prep',
      subject: null,
      levelType: 'other',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const lesson = createLessonPlan({
      classId: cls.id,
      date: '2026-10-09',
      weekLabel: null,
      title: 'Private resource check',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    const privateResource = createLessonResource({
      title: 'Teacher answer key',
      type: 'note',
      url: null,
      filePath: null,
      notes: 'Do not show students.',
      tags: [],
      standardId: null,
      classId: cls.id,
      shareWithStudents: false,
      studyGuide: null
    })
    linkLessonResource(lesson.id, privateResource.id)

    const result = await offlineLessonPackZip(lesson.id)
    expect(result.resources).toBe(0)
    const zip = await JSZip.loadAsync(result.buffer)
    const index = await zip.file('index.html')!.async('string')
    expect(index).not.toContain('Teacher answer key')
    expect(index).not.toContain('Do not show students.')
  })
})
