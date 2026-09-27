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
import { addBehaviourPoint, behaviourTotals, undoLastBehaviourPoint } from '../behaviourPoints'
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
})
