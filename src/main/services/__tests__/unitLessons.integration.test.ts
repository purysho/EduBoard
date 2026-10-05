import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createScheduleSlot } from '../../repositories/classScheduleSlots'
import { createLessonPlan, listLessonPlansByClass } from '../../repositories/lessonPlans'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createUnitLessons, nextTeachingDates } from '../unitLessons'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-unit-lessons-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

function makeClass(): string {
  return createClass({
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
}

const slot = (classId: string, dayOfWeek: number): void => {
  createScheduleSlot({ classId, dayOfWeek, startTime: '08:00', endTime: '09:35', room: null })
}

// 2026-10-05 is a Monday.
describe('unit lessons', () => {
  it("go on the class's timetable days, skipping days that already have a lesson", () => {
    const classId = makeClass()
    slot(classId, 1)
    slot(classId, 3)
    createLessonPlan({
      classId,
      date: '2026-10-07',
      weekLabel: null,
      title: 'Already planned',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    expect(nextTeachingDates(classId, '2026-10-05', 4)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-14',
      '2026-10-19'
    ])
  })

  it('go weekly from the start date when the class has no timetable', () => {
    const classId = makeClass()
    expect(nextTeachingDates(classId, '2026-10-06', 3)).toEqual([
      '2026-10-06',
      '2026-10-13',
      '2026-10-20'
    ])
    expect(() => nextTeachingDates(classId, 'soon', 3)).toThrow()
  })

  it('are added as planned lessons labelled with the unit, floor and stretch kept', () => {
    const classId = makeClass()
    slot(classId, 2)
    const created = createUnitLessons({
      classId,
      unitTitle: 'University life',
      startDate: '2026-10-05',
      lessons: [
        {
          title: 'My timetable',
          objectives: 'Aim\nCheck: quiz',
          support: 'Frames',
          stretch: 'Twist'
        },
        { title: '   ', objectives: '' },
        { title: 'My dorm', objectives: 'Describe a room' }
      ]
    })
    expect(created.map((p) => [p.date, p.title, p.weekLabel, p.status])).toEqual([
      ['2026-10-06', 'My timetable', 'University life 1/2', 'planned'],
      ['2026-10-13', 'My dorm', 'University life 2/2', 'planned']
    ])
    expect(created[0]).toMatchObject({ support: 'Frames', stretch: 'Twist', materials: null })
    expect(listLessonPlansByClass(classId)).toHaveLength(2)
  })

  it('refuse a class that does not exist', () => {
    expect(() =>
      createUnitLessons({
        classId: 'missing',
        unitTitle: 'x',
        startDate: '2026-10-05',
        lessons: [{ title: 'a', objectives: '' }]
      })
    ).toThrow(/That class no longer exists/)
  })
})
