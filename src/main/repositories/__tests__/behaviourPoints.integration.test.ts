import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { closeDb, getDb, initDb, setDbPathForTesting } from '../../db/client'
import { behaviourPoints } from '../../db/schema'
import { createClass } from '../classes'
import { createStudent } from '../students'
import {
  addBehaviourPoint,
  behaviourTotals,
  pointSummaries,
  undoLastBehaviourPoint
} from '../behaviourPoints'
import { updateSettings } from '../settingsRepo'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
let classId: string
let a: string
let b: string

const student = (firstName: string): string =>
  createStudent({
    firstName,
    lastName: 'T',
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  }).id

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-points-'))
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
  a = student('A')
  b = student('B')
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

describe('behaviour points', () => {
  it('totals this week and all time per student', () => {
    const old = addBehaviourPoint({ classId, studentId: a, points: 1 })
    getDb()
      .update(behaviourPoints)
      .set({ createdAt: '2020-01-01T00:00:00.000Z' })
      .where(eq(behaviourPoints.id, old.id))
      .run()
    addBehaviourPoint({ classId, studentId: a, points: 1, reason: 'Helping' })
    addBehaviourPoint({ classId, studentId: a, points: -1 })
    addBehaviourPoint({ classId, studentId: b, points: 1 })
    const totals = behaviourTotals(classId, '2026-01-01T00:00:00.000Z')
    expect(totals.find((t) => t.studentId === a)).toEqual({ studentId: a, week: 0, total: 1 })
    expect(totals.find((t) => t.studentId === b)).toEqual({ studentId: b, week: 1, total: 1 })
  })

  it('keeps each tap between −5 and +5, and never zero', () => {
    expect(addBehaviourPoint({ classId, studentId: a, points: 100 }).points).toBe(5)
    expect(addBehaviourPoint({ classId, studentId: a, points: 0 }).points).toBe(1)
  })

  it('undoes the most recent point only', async () => {
    addBehaviourPoint({ classId, studentId: a, points: 1 })
    await new Promise((r) => setTimeout(r, 5))
    const last = addBehaviourPoint({ classId, studentId: b, points: -1 })
    expect(undoLastBehaviourPoint(classId)?.id).toBe(last.id)
    expect(behaviourTotals(classId, '2000-01-01').map((t) => t.studentId)).toEqual([a])
  })

  it('stores the category and totals points per category', () => {
    updateSettings({
      pointCategories: [
        { id: 'wuyu-de', name: 'Character' },
        { id: 'wuyu-zhi', name: 'Learning' }
      ]
    })
    const p = addBehaviourPoint({ classId, studentId: a, points: 1, category: 'wuyu-zhi' })
    expect(p).toMatchObject({ category: 'wuyu-zhi', reason: 'Learning' })
    addBehaviourPoint({ classId, studentId: a, points: 2, category: 'wuyu-zhi' })
    addBehaviourPoint({ classId, studentId: a, points: 1, category: 'wuyu-de' })
    // Not one of the school's categories: kept as a point with none.
    expect(
      addBehaviourPoint({ classId, studentId: a, points: -1, category: 'made-up' }).category
    ).toBeNull()
    addBehaviourPoint({ classId, studentId: b, points: 1 })
    const all = pointSummaries(classId)
    expect(all.get(a)).toEqual([
      { categoryId: 'wuyu-de', name: 'Character', total: 1 },
      { categoryId: 'wuyu-zhi', name: 'Learning', total: 3 },
      { categoryId: null, name: 'Other', total: -1 }
    ])
    expect(pointSummaries(classId, '2999-01-01').size).toBe(0)
  })
})
