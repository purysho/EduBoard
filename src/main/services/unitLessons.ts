// Turning an accepted unit plan into the class's lessons: one planned lesson on each of
// the class's next teaching days (its timetable weekdays), skipping days that already
// have a lesson, so a unit never lands on top of what the teacher has planned.
import { AppError } from '@shared/errorCodes'
import { addDays } from '@shared/dates'
import { UNIT_MAX_LESSONS, unitLessonLabel, type CreateUnitLessonsInput } from '@shared/unitPlan'
import type { LessonPlan } from '@shared/types'
import { getSqlite } from '../db/client'
import { getClass } from '../repositories/classes'
import { listScheduleSlotsByClass } from '../repositories/classScheduleSlots'
import { createLessonPlan, listLessonPlansByClass } from '../repositories/lessonPlans'

const DATE = /^\d{4}-\d{2}-\d{2}$/
/** How far ahead to look for free teaching days before giving up (two school years). */
const SEARCH_DAYS = 730

/** The class's next `count` teaching days from `from` (inclusive) that have no lesson yet.
 * A class without a timetable gets one lesson a week, on `from`'s weekday. */
export function nextTeachingDates(classId: string, from: string, count: number): string[] {
  if (!DATE.test(from)) throw new AppError('EB-0002', 'Invalid start date.')
  const weekdays = new Set(listScheduleSlotsByClass(classId).map((s) => s.dayOfWeek))
  if (!weekdays.size) weekdays.add(new Date(`${from}T00:00:00Z`).getUTCDay())
  const taken = new Set(listLessonPlansByClass(classId).map((p) => p.date))
  const dates: string[] = []
  for (let i = 0; i < SEARCH_DAYS && dates.length < count; i++) {
    const date = addDays(from, i)
    if (weekdays.has(new Date(`${date}T00:00:00Z`).getUTCDay()) && !taken.has(date)) {
      dates.push(date)
    }
  }
  return dates
}

const clean = (value: unknown, max: number): string | null => {
  const t = (typeof value === 'string' ? value : '').trim().slice(0, max)
  return t || null
}

/** Adds a unit's lessons to the class, all or none. */
export function createUnitLessons(input: CreateUnitLessonsInput): LessonPlan[] {
  if (!getClass(input.classId)) throw new AppError('EB-0002', 'Class not found.')
  const lessons = (Array.isArray(input.lessons) ? input.lessons : [])
    .filter((l) => clean(l?.title, 200))
    .slice(0, UNIT_MAX_LESSONS)
  if (!lessons.length) return []
  const dates = nextTeachingDates(input.classId, input.startDate, lessons.length)
  const unitTitle = clean(input.unitTitle, 200) ?? ''
  return getSqlite().transaction(() =>
    lessons.map((lesson, i) =>
      createLessonPlan({
        classId: input.classId,
        // Past two years of free days (never in practice), the rest follow weekly.
        date: dates[i] ?? addDays(dates[dates.length - 1] ?? input.startDate, 7 * (i + 1)),
        weekLabel: unitTitle ? unitLessonLabel(unitTitle, i, lessons.length) : null,
        title: clean(lesson.title, 200) as string,
        objectives: clean(lesson.objectives, 2000),
        framework: null,
        materials: clean(lesson.materials, 4000),
        activities: clean(lesson.activities, 8000),
        support: clean(lesson.support, 4000),
        stretch: clean(lesson.stretch, 4000),
        homework: clean(lesson.homework, 4000),
        linkedAssessmentId: null,
        standards: null
      })
    )
  )()
}
