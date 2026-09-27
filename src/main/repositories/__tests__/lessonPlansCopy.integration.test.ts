import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../classes'
import { copyWeekOfPlans, createLessonPlan, listLessonPlansByClass } from '../lessonPlans'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
let classId: string
const plan = (date: string, title: string): void => {
  createLessonPlan({
    classId,
    date,
    weekLabel: 'Unit 3',
    title,
    objectives: 'Obj',
    framework: null,
    materials: null,
    activities: 'Act',
    homework: null,
    linkedAssessmentId: null,
    standards: null
  })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-plans-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
  classId = createClass({
    name: 'G4',
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
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('copying last week’s lesson plans', () => {
  it('copies each plan to the same weekday a week later, once', () => {
    plan('2026-09-21', 'Mon lesson') // Monday
    plan('2026-09-25', 'Fri lesson') // Friday
    plan('2026-09-14', 'Too early') // the week before
    plan('2026-09-28', 'Mon lesson') // already planned this week
    expect(copyWeekOfPlans(classId, '2026-09-21', '2026-09-28')).toBe(1)
    const thisWeek = listLessonPlansByClass(classId)
      .filter((p) => p.date >= '2026-09-28')
      .map((p) => [p.date, p.title, p.status])
    expect(thisWeek.sort()).toEqual([
      ['2026-09-28', 'Mon lesson', 'planned'],
      ['2026-10-02', 'Fri lesson', 'planned']
    ])
    expect(copyWeekOfPlans(classId, '2026-09-21', '2026-09-28')).toBe(0)
  })
})
