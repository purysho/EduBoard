import { describe, expect, it } from 'vitest'
import { isShownWhilePresenting } from '../presenting'

describe('presenting mode', () => {
  it('keeps the pages a class sees on the projector', () => {
    for (const path of [
      '/classes',
      '/classes/abc/seating',
      '/classes/abc/classroom',
      '/classes/abc/exit-ticket',
      '/classes/abc/attendance',
      '/classes/abc/lessons',
      '/timetable',
      '/rubrics/r1'
    ]) {
      expect(isShownWhilePresenting(path)).toBe(true)
    }
  })

  it('hides anything with grades, notes, contacts or keys', () => {
    for (const path of [
      '/',
      '/students',
      '/students/s1',
      '/classes/abc',
      '/classes/abc/gradebook',
      '/classes/abc/report',
      '/classes/abc/homework',
      '/classes/abc/portal',
      '/classes/abc/settings',
      '/analytics',
      '/composite-grades',
      '/messages',
      '/communications',
      '/audit-log',
      '/settings'
    ]) {
      expect(isShownWhilePresenting(path)).toBe(false)
    }
  })
})
