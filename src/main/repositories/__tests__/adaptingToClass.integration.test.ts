import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createClass, getClass, updateClass } from '../classes'
import {
  copyWeekOfPlans,
  createLessonPlan,
  listLessonPlansByClass,
  shiftPlannedLessons,
  updateLessonPlan
} from '../lessonPlans'

let dir: string
let classId: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-adapting-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
  classId = createClass({
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
  }).id
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const lesson = (date: string, title: string): string =>
  createLessonPlan({
    classId,
    date,
    weekLabel: null,
    title,
    objectives: null,
    framework: null,
    materials: null,
    activities: null,
    homework: null,
    linkedAssessmentId: null,
    standards: null
  }).id

describe('adapting the plan to the class', () => {
  it('moves only still-planned lessons from a date on, keeping each first planned date', () => {
    const taught = lesson('2026-10-05', 'Read with a purpose')
    const partly = lesson('2026-10-07', 'Listen and capture meaning')
    lesson('2026-10-12', 'Say it in your own words')
    lesson('2026-10-14', 'Make data speak')
    updateLessonPlan(taught, { status: 'taught' })
    updateLessonPlan(partly, { status: 'partly' })

    expect(shiftPlannedLessons(classId, '2026-10-06', 7)).toBe(2)
    const byTitle = Object.fromEntries(listLessonPlansByClass(classId).map((p) => [p.title, p]))
    expect(byTitle['Read with a purpose'].date).toBe('2026-10-05')
    expect(byTitle['Listen and capture meaning'].date).toBe('2026-10-07')
    expect(byTitle['Say it in your own words'].date).toBe('2026-10-19')
    expect(byTitle['Say it in your own words'].originalDate).toBe('2026-10-12')
    expect(byTitle['Make data speak'].date).toBe('2026-10-21')
    expect(shiftPlannedLessons(classId, '2026-10-06', 0)).toBe(0)
  })

  it('closes the gap a dropped lesson leaves by moving later lessons a week earlier', () => {
    lesson('2027-05-10', 'Solve a problem together')
    const flex = lesson('2027-05-17', 'Professional networking')
    lesson('2027-05-24', 'Research communication')
    updateLessonPlan(flex, { status: 'skipped' })

    expect(shiftPlannedLessons(classId, '2027-05-24', -7)).toBe(1)
    const byTitle = Object.fromEntries(listLessonPlansByClass(classId).map((p) => [p.title, p]))
    expect(byTitle['Research communication'].date).toBe('2027-05-17')
    expect(byTitle['Research communication'].originalDate).toBe('2027-05-24')
    // The skipped lesson stays on record where it was planned.
    expect(byTitle['Professional networking'].date).toBe('2027-05-17')
    expect(byTitle['Solve a problem together'].date).toBe('2027-05-10')
  })

  it('keeps Support and Stretch when a week is copied', () => {
    const id = lesson('2026-10-05', 'Build an argument')
    updateLessonPlan(id, { support: 'Sentence frames', stretch: 'Add a counterargument' })
    expect(copyWeekOfPlans(classId, '2026-10-05', '2026-10-12')).toBe(1)
    const copy = listLessonPlansByClass(classId).find((p) => p.date === '2026-10-12')
    expect(copy).toMatchObject({ support: 'Sentence frames', stretch: 'Add a counterargument' })
  })

  it('a class can be set to no homework', () => {
    expect(getClass(classId)?.noHomework).toBe(false)
    updateClass(classId, { noHomework: true })
    expect(getClass(classId)?.noHomework).toBe(true)
  })
})
