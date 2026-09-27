import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createLessonPlan } from '../../repositories/lessonPlans'
import { createHomeworkAssignment } from '../../repositories/homeworkAssignments'
import { getWeeklySummary, weeklySummaryHtml } from '../weeklySummary'
import { gatherNewsletterFacts } from '../newsletterService'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-weekly-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const NOW = new Date('2026-09-30T10:00:00Z')

function setUp(): string {
  const cls = createClass({
    name: 'Grade 4 <English>',
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
  for (const firstName of ['Mai', 'Leo']) {
    const s = createStudent({
      firstName,
      lastName: 'Chen',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    enrollStudent({ studentId: s.id, classId: cls, enrolledOn: '2026-09-01' })
  }
  const plan = (date: string, title: string): void => {
    createLessonPlan({
      classId: cls,
      date,
      weekLabel: null,
      title,
      objectives: '- Name ten animals',
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
  }
  plan('2026-09-28', 'Animals: reading')
  plan('2026-10-02', 'Animals: writing')
  const homework = (title: string, dueDate: string): void => {
    createHomeworkAssignment({
      classId: cls,
      title,
      description: null,
      dueDate,
      status: 'published',
      fileName: null,
      filePath: null,
      topic: null,
      rubricId: null
    } as never)
  }
  homework('Animal fact sheet', '2026-10-03')
  homework('Vocab list', '2026-09-27')
  return cls
}

describe('the weekly summary and newsletter facts', () => {
  it('lists what was taught, what’s due and what wasn’t handed in, escaped for email', () => {
    setUp()
    const summary = getWeeklySummary(NOW)
    const c = summary.classes[0]
    expect(c.students).toBe(2)
    expect(c.taught).toEqual(['Animals: reading'])
    expect(c.comingUp).toEqual(['Animals: writing'])
    expect(c.dueSoon.map((d) => d.title)).toEqual(['Animal fact sheet'])
    expect(c.notHandedIn).toEqual([{ title: 'Vocab list', missing: 2, of: 2 }])
    const html = weeklySummaryHtml(summary)
    expect(html).toContain('Grade 4 &lt;English&gt;')
    expect(html).not.toContain('<English>')
  })

  it('gathers class-level facts only, never a student’s name', async () => {
    const cls = setUp()
    const facts = await gatherNewsletterFacts(
      {
        classIds: [cls],
        lessons: true,
        upcoming: true,
        homework: true,
        posts: false,
        numbers: true
      },
      NOW
    )
    expect(facts.map((f) => f.kind)).toEqual(['lesson', 'upcoming', 'homework'])
    expect(facts[0].text).toBe('Animals: reading (Name ten animals)')
    expect(JSON.stringify(facts)).not.toMatch(/Mai|Leo/)
  })
})
