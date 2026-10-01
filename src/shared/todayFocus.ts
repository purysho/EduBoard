import type { TodayLesson } from './types'

export type TodayLessonFocus = {
  index: number
  state: 'current' | 'next'
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null
  }
  return hours * 60 + minutes
}

/** Finds the lesson that deserves the Dashboard's primary action area right now. */
export function todayLessonFocus(
  lessons: TodayLesson[],
  now: Date = new Date()
): TodayLessonFocus | null {
  const minute = now.getHours() * 60 + now.getMinutes()
  for (let i = 0; i < lessons.length; i++) {
    const start = timeToMinutes(lessons[i].startTime)
    const end = timeToMinutes(lessons[i].endTime)
    if (start === null || end === null) continue
    if (minute >= start && minute < end) return { index: i, state: 'current' }
  }
  for (let i = 0; i < lessons.length; i++) {
    const start = timeToMinutes(lessons[i].startTime)
    if (start !== null && minute < start) return { index: i, state: 'next' }
  }
  return null
}
