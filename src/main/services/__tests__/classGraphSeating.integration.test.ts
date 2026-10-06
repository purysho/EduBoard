import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createClass, getClass, updateClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { assignSeat, listSeatAssignments } from '../../repositories/seatAssignments'
import { parseClassGraphHandback, type ClassGraphHandbackV1 } from '@shared/classGraphHandback'
import {
  applyClassGraphSeating,
  exportClassForClassGraph,
  previewClassGraphSeatingForClass
} from '../classGraphSeating'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-classgraph-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function setup(): { classId: string; ids: string[] } {
  const cls = createClass({
    name: '五年级（3）班 English',
    subject: 'English',
    levelType: 'k12',
    gradeLevel: 'Grade 5',
    termId: null,
    courseGroupId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  })
  updateClass(cls.id, { seatingRows: 2, seatingCols: 3 })
  const names: [string, string][] = [
    ['喆', '张'],
    ['玥', '李'],
    ['Lily', 'Chen']
  ]
  const ids = names.map(([firstName, lastName]) => {
    const student = createStudent({
      firstName,
      lastName,
      preferredName: null,
      studentNumber: 'PRIVATE',
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: 'PRIVATE GUARDIAN',
      guardianContact: null,
      email: null,
      notes: 'PRIVATE NOTE'
    })
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })
    return student.id
  })
  assignSeat(cls.id, ids[0]!, 0, 0)
  assignSeat(cls.id, ids[1]!, 0, 1)
  return { classId: cls.id, ids }
}

/** What ClassGraph sends back: the shape of src/eduboard-handback.ts in ClassGraph. */
function handback(
  seats: { studentId: string; row: number; col: number }[],
  unmapped = 0
): ClassGraphHandbackV1 {
  return parseClassGraphHandback(
    JSON.stringify({
      format: 'classgraph-eduboard-handback',
      version: '1.0',
      project: {
        schemaVersion: '1.0',
        projectId: 'cg-1',
        title: 'Grade 5 plan',
        updatedAt: '2026-10-06T10:00:00.000Z'
      },
      compatibility: {
        targetApplication: 'EduBoard',
        targetContractVersion: '1',
        requiresExplicitClassSelection: true,
        studentIdMapping: 'exact-id-only',
        seatCoordinates: 'zero-based-row-col'
      },
      sourceData: { studentReferences: [], sourceFieldValues: [] },
      derivedAnalysis: {},
      approvedPlanning: {
        room: null,
        seatAssignments: seats.map((seat) => ({
          ...seat,
          seatId: `seat-r${seat.row + 1}-c${seat.col + 1}`,
          locked: false
        })),
        unmappedSeatAssignments: Array.from({ length: unmapped }, (_, i) => ({
          studentId: `custom-${i}`,
          seatId: `custom-${i}`,
          locked: false,
          reason: 'seat-has-no-grid-coordinate'
        })),
        groups: [],
        rules: []
      },
      syntheticPaths: [],
      derivedPaths: [],
      provenance: {}
    })
  )
}

describe('ClassGraph round trip', () => {
  it('exports only the roster names and seating grid, with EduBoard student IDs', () => {
    const { classId, ids } = setup()
    const { fileName, project } = exportClassForClassGraph(classId)
    const text = JSON.stringify(project)

    expect(fileName).toBe('五年级3班 English.classgraph.json')
    expect(project.students).toEqual([
      { id: ids[0], displayName: '张喆', metrics: {} },
      { id: ids[1], displayName: '李玥', metrics: {} },
      { id: ids[2], displayName: 'Lily Chen', metrics: {} }
    ])
    expect(project.room).toMatchObject({ layout: 'grid', rows: 2, columns: 3 })
    expect((project.planning as { assignments: unknown[] }).assignments).toEqual([
      { studentId: ids[0], seatId: 'seat-r1-c1', locked: false },
      { studentId: ids[1], seatId: 'seat-r1-c2', locked: false }
    ])
    expect(text).not.toContain('PRIVATE')
  })

  it('previews and replaces the whole chart in one step', () => {
    const { classId, ids } = setup()
    const plan = handback(
      [
        { studentId: ids[2]!, row: 0, col: 0 },
        { studentId: ids[0]!, row: 1, col: 2 }
      ],
      1
    )
    const preview = previewClassGraphSeatingForClass(classId, plan)
    expect(preview).toMatchObject({
      unknownStudentIds: [],
      gridFits: true,
      unseatedAfter: 1,
      currentSeatCount: 2,
      unmappedSeatCount: 1
    })
    expect(preview.seats.map((seat) => seat.name)).toEqual(['Lily Chen', '张喆'])

    expect(applyClassGraphSeating(classId, plan, { resizeGrid: false })).toEqual({
      seated: 2,
      gridResized: false
    })
    const seats = listSeatAssignments(classId)
      .map((seat) => [seat.studentId, seat.row, seat.col])
      .sort()
    expect(seats).toEqual(
      [
        [ids[2], 0, 0],
        [ids[0], 1, 2]
      ].sort()
    )
  })

  it('refuses a plan with students from another class and changes nothing', () => {
    const { classId, ids } = setup()
    const before = listSeatAssignments(classId)
    const plan = handback([
      { studentId: ids[0]!, row: 1, col: 1 },
      { studentId: 'someone-else', row: 0, col: 0 }
    ])
    expect(previewClassGraphSeatingForClass(classId, plan).unknownStudentIds).toEqual([
      'someone-else'
    ])
    expect(() => applyClassGraphSeating(classId, plan, { resizeGrid: true })).toThrow(
      expect.objectContaining({ code: 'EB-2010' })
    )
    expect(listSeatAssignments(classId)).toEqual(before)
  })

  it('enlarges the grid only when the teacher allows it', () => {
    const { classId, ids } = setup()
    const plan = handback([{ studentId: ids[1]!, row: 3, col: 4 }])
    expect(previewClassGraphSeatingForClass(classId, plan)).toMatchObject({
      gridFits: false,
      gridNeeded: { rows: 4, cols: 5 }
    })
    expect(() => applyClassGraphSeating(classId, plan, { resizeGrid: false })).toThrow(
      expect.objectContaining({ code: 'EB-2010' })
    )
    expect(getClass(classId)).toMatchObject({ seatingRows: 2, seatingCols: 3 })

    expect(applyClassGraphSeating(classId, plan, { resizeGrid: true })).toEqual({
      seated: 1,
      gridResized: true
    })
    expect(getClass(classId)).toMatchObject({ seatingRows: 4, seatingCols: 5 })
    expect(listSeatAssignments(classId)).toEqual([
      expect.objectContaining({ studentId: ids[1], row: 3, col: 4 })
    ])
  })
})
