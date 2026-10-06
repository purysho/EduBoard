import { describe, expect, it } from 'vitest'
import {
  clampLessonCount,
  objectivesWithCheck,
  parseUnitPlan,
  unitLessonContext,
  unitLessonLabel
} from '../unitPlan'

const unit = {
  title: 'University life',
  prerequisites: ['Present simple', 'Numbers 1–100'],
  lessons: [
    { title: 'My timetable', objectives: 'Say what classes I have', check: 'Pair quiz' },
    { title: 'My dorm', objectives: 'Describe my room', check: '' },
    { title: 'Clubs', objectives: 'Ask about clubs', check: 'Exit ticket' }
  ]
}

describe('unit plans', () => {
  it('keeps the lessons asked for, cleans every field, joins lists and drops untitled lessons', () => {
    const plan = parseUnitPlan(
      {
        title: '  Unit\u0007 one ',
        prerequisites: ['A', null, ['B', 'C'], ''],
        lessons: [
          { title: 'One', objectives: 'Aim 1', check: 'Check 1' },
          { title: '', objectives: 'No title' },
          { title: 'Two', objectives: ['Ask', 'Answer'] },
          { title: 'Three' }
        ]
      },
      'topic',
      2
    )
    expect(plan.title).toBe('Unit one')
    expect(plan.prerequisites).toEqual(['A', 'B; C'])
    expect(plan.lessons).toEqual([
      { title: 'One', objectives: 'Aim 1', check: 'Check 1' },
      { title: 'Two', objectives: 'Ask; Answer', check: '' }
    ])
  })

  it('falls back to the topic for a missing title and fails on a reply with no lessons', () => {
    expect(parseUnitPlan({ lessons: [{ title: 'L1' }] }, 'Greetings', 4).title).toBe('Greetings')
    expect(() => parseUnitPlan({ title: 'x', lessons: [] }, 't', 4)).toThrow(/no lessons/)
    expect(() => parseUnitPlan(null, 't', 4)).toThrow()
  })

  it('clamps the number of lessons', () => {
    expect(clampLessonCount(1)).toBe(2)
    expect(clampLessonCount(40)).toBe(12)
    expect(clampLessonCount('5')).toBe(5)
    expect(clampLessonCount('lots')).toBe(6)
  })

  it('tells a full lesson draft where it sits in the unit', () => {
    const first = unitLessonContext(unit, 0)
    expect(first).toContain('lesson 1 of 3 in the unit "University life"')
    expect(first).toContain('Start by briefly revisiting: Present simple; Numbers 1–100')
    expect(first).toContain('End the lesson with this check: Pair quiz')
    expect(first).toContain('The lesson after: My dorm')
    expect(first).not.toContain('The lesson before')

    const middle = unitLessonContext(unit, 1)
    expect(middle).toContain('The lesson before: My timetable')
    expect(middle).not.toContain('revisiting')
    expect(middle).not.toContain('check:')
  })

  it('labels and folds the check into a lesson', () => {
    expect(unitLessonLabel('University life', 1, 6)).toBe('University life 2/6')
    expect(unitLessonLabel('x'.repeat(100), 0, 12)).toHaveLength(60)
    expect(objectivesWithCheck(unit.lessons[0])).toBe('Say what classes I have\nCheck: Pair quiz')
    expect(objectivesWithCheck(unit.lessons[1])).toBe('Describe my room')
  })
})
