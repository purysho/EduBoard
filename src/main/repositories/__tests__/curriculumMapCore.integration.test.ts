import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createClass } from '../classes'
import {
  createLessonPlan,
  getLessonPlan,
  linkLessonResource,
  listLessonResourceIds,
  setLessonResources,
  updateLessonPlan
} from '../lessonPlans'
import { createLessonResource } from '../lessonResources'

let dir: string
let classId: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-curriculum-map-core-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
  classId = createClass({
    name: 'Course map class',
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
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

function resource(title: string): string {
  return createLessonResource({
    title,
    type: 'note',
    url: null,
    filePath: null,
    notes: title,
    tags: [],
    standardId: null,
    classId: null,
    shareWithStudents: false,
    studyGuide: null
  }).id
}

describe('curriculum map lesson foundations', () => {
  it('keeps the first scheduled date when a lesson is moved', () => {
    const lesson = createLessonPlan({
      classId,
      date: '2026-09-08',
      weekLabel: 'Week 1',
      title: 'Session 1',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })

    expect(lesson.originalDate).toBe('2026-09-08')
    updateLessonPlan(lesson.id, { date: '2026-09-10' })
    expect(getLessonPlan(lesson.id)).toMatchObject({
      date: '2026-09-10',
      originalDate: '2026-09-08'
    })
  })

  it('adds or replaces explicit lesson-resource links without duplicating pairs', () => {
    const lesson = createLessonPlan({
      classId,
      date: '2026-09-08',
      weekLabel: null,
      title: 'Session 1',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    const first = resource('Model')
    const second = resource('Reading')

    linkLessonResource(lesson.id, first)
    linkLessonResource(lesson.id, first)
    expect(listLessonResourceIds(lesson.id)).toEqual([first])

    setLessonResources(lesson.id, [first, second, second])
    expect(new Set(listLessonResourceIds(lesson.id))).toEqual(new Set([first, second]))

    setLessonResources(lesson.id, [second])
    expect(listLessonResourceIds(lesson.id)).toEqual([second])
  })
})
