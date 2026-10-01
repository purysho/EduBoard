import { describe, expect, it } from 'vitest'
import { todayLessonFocus, timeToMinutes } from '../todayFocus'
import type { TodayLesson } from '../types'

const lesson = (startTime: string, endTime: string): TodayLesson => ({
  classId: startTime,
  className: startTime,
  classColor: null,
  startTime,
  endTime,
  room: null,
  attendanceTaken: false,
  lessonPlanTitle: null
})

const at = (hour: number, minute: number): Date => {
  const d = new Date(2026, 9, 1, hour, minute, 0, 0)
  return d
}

describe('today lesson focus', () => {
  const lessons = [lesson('09:00', '09:40'), lesson('10:00', '10:40'), lesson('13:30', '14:10')]

  it('selects a lesson that is happening now', () => {
    expect(todayLessonFocus(lessons, at(9, 15))).toEqual({ index: 0, state: 'current' })
    expect(todayLessonFocus(lessons, at(10, 39))).toEqual({ index: 1, state: 'current' })
  })

  it('selects the next lesson between classes and before the day starts', () => {
    expect(todayLessonFocus(lessons, at(8, 0))).toEqual({ index: 0, state: 'next' })
    expect(todayLessonFocus(lessons, at(9, 50))).toEqual({ index: 1, state: 'next' })
  })

  it('returns null once every lesson is finished', () => {
    expect(todayLessonFocus(lessons, at(18, 0))).toBeNull()
  })

  it('ignores malformed timetable times instead of guessing', () => {
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('09:75')).toBeNull()
    expect(todayLessonFocus([lesson('bad', '10:00'), lesson('11:00', '11:40')], at(10, 30))).toEqual({
      index: 1,
      state: 'next'
    })
  })
})
