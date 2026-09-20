import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../classes'
import { createStudent } from '../students'
import {
  assignSeat,
  clearSeatingChart,
  listSeatAssignments,
  pruneOutOfBoundsSeats,
  unassignSeat
} from '../seatAssignments'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function makeClass(): string {
  return createClass({
    name: 'Grade 5',
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
}

function makeStudent(firstName: string): string {
  return createStudent({
    firstName,
    lastName: 'Test',
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  }).id
}

describe('seat assignments', () => {
  it('places a student in an empty seat', () => {
    const classId = makeClass()
    const studentId = makeStudent('Amy')

    assignSeat(classId, studentId, 1, 2)

    const seats = listSeatAssignments(classId)
    expect(seats).toHaveLength(1)
    expect(seats[0]).toMatchObject({ studentId, row: 1, col: 2 })
  })

  it('moves a student who already has a seat, rather than duplicating them', () => {
    const classId = makeClass()
    const studentId = makeStudent('Ben')

    assignSeat(classId, studentId, 0, 0)
    assignSeat(classId, studentId, 3, 3)

    const seats = listSeatAssignments(classId)
    expect(seats).toHaveLength(1)
    expect(seats[0]).toMatchObject({ row: 3, col: 3 })
  })

  it('swaps two students when one is placed on the other’s seat', () => {
    const classId = makeClass()
    const alice = makeStudent('Alice')
    const bob = makeStudent('Bob')

    assignSeat(classId, alice, 0, 0)
    assignSeat(classId, bob, 1, 1)

    // Move Alice onto Bob's seat — Bob should land on Alice's old seat, not vanish.
    assignSeat(classId, alice, 1, 1)

    const seats = listSeatAssignments(classId)
    expect(seats).toHaveLength(2)
    const byStudent = new Map(seats.map((s) => [s.studentId, s]))
    expect(byStudent.get(alice)).toMatchObject({ row: 1, col: 1 })
    expect(byStudent.get(bob)).toMatchObject({ row: 0, col: 0 })
  })

  it('unassigns a single seat and clears the whole chart', () => {
    const classId = makeClass()
    const alice = makeStudent('Alice')
    const bob = makeStudent('Bob')
    assignSeat(classId, alice, 0, 0)
    assignSeat(classId, bob, 1, 1)

    unassignSeat(classId, alice)
    expect(listSeatAssignments(classId)).toHaveLength(1)

    clearSeatingChart(classId)
    expect(listSeatAssignments(classId)).toHaveLength(0)
  })

  it('unseats only students whose row or col falls outside a shrunk grid', () => {
    const classId = makeClass()
    const inBounds = makeStudent('Cara')
    const outByRow = makeStudent('Dan')
    const outByCol = makeStudent('Eve')

    assignSeat(classId, inBounds, 1, 1)
    assignSeat(classId, outByRow, 4, 1) // row 4 is out of bounds once rows shrink to 3
    assignSeat(classId, outByCol, 1, 5) // col 5 is out of bounds once cols shrink to 4

    pruneOutOfBoundsSeats(classId, 3, 4)

    const remaining = listSeatAssignments(classId)
    expect(remaining.map((s) => s.studentId)).toEqual([inBounds])
  })

  it('leaves every seat alone when the grid grows or stays the same', () => {
    const classId = makeClass()
    const student = makeStudent('Fay')
    assignSeat(classId, student, 4, 5)

    pruneOutOfBoundsSeats(classId, 5, 6)
    expect(listSeatAssignments(classId)).toHaveLength(1)

    pruneOutOfBoundsSeats(classId, 10, 10)
    expect(listSeatAssignments(classId)).toHaveLength(1)
  })
})
