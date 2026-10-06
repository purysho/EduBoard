import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildClassGraphExport,
  ClassGraphHandbackError,
  parseClassGraphHandback,
  planClassGraphSeatWrites,
  previewClassGraphSeating
} from '../classGraphHandback'

const fixturePath = join(
  process.cwd(),
  'src/shared/__tests__/fixtures/classgraph-eduboard-handback-v1.json'
)

describe('ClassGraph hand-back contract', () => {
  it('accepts the v1 fixture and preserves zero-based seating coordinates', () => {
    const handback = parseClassGraphHandback(readFileSync(fixturePath, 'utf8'))
    expect(handback.compatibility.studentIdMapping).toBe('exact-id-only')
    expect(handback.approvedPlanning.seatAssignments).toEqual([
      {
        studentId: 'student-1',
        seatId: 'seat-r1-c1',
        row: 0,
        col: 0,
        locked: true
      }
    ])
  })

  it('plans seat writes only after explicit class and exact student mapping', () => {
    const handback = parseClassGraphHandback(readFileSync(fixturePath, 'utf8'))
    expect(planClassGraphSeatWrites(handback, 'class-1', ['student-1'])).toEqual([
      { classId: 'class-1', studentId: 'student-1', row: 0, col: 0 }
    ])
    expect(() => planClassGraphSeatWrites(handback, '', ['student-1'])).toThrow(
      ClassGraphHandbackError
    )
    expect(() => planClassGraphSeatWrites(handback, 'class-1', [])).toThrow(
      /exact ID mapping is required/
    )
  })

  it('rejects source fields also labelled synthetic or derived', () => {
    const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>
    raw.syntheticPaths = ['/title']
    expect(() => parseClassGraphHandback(JSON.stringify(raw))).toThrow(/derived or synthetic data/)
  })

  it('contains no database or repository write path', () => {
    const source = readFileSync(join(process.cwd(), 'src/shared/classGraphHandback.ts'), 'utf8')
    expect(source).not.toContain('getDb(')
    expect(source).not.toContain('assignSeat(')
    expect(source).not.toContain('@main/repositories')
    expect(source).not.toContain('../main/repositories')
    expect(source).not.toContain('../db/')
  })
})

// The same two fixtures live in ClassGraph (tests/fixtures/), so a change on either side that
// breaks the round trip fails a test in both repositories.
describe('ClassGraph round trip fixtures', () => {
  const fixture = (name: string): string =>
    readFileSync(join(process.cwd(), 'src/shared/__tests__/fixtures', name), 'utf8')

  it('exports a class exactly as ClassGraph expects to open it', () => {
    const project = buildClassGraphExport({
      projectId: 'eduboard-export-fixture',
      exportedAt: '2026-10-06T10:00:00.000Z',
      classSection: {
        id: 'eb-class-5-3',
        name: '五年级（3）班 English',
        subject: 'English',
        gradeLevel: 'Grade 5',
        seatingRows: 2,
        seatingCols: 3
      },
      students: [
        { id: 'eb-student-1', firstName: '喆', lastName: '张' },
        { id: 'eb-student-2', firstName: '玥', lastName: '李' },
        { id: 'eb-student-3', firstName: 'Lily', lastName: 'Chen' }
      ],
      seats: [
        { studentId: 'eb-student-1', row: 0, col: 0 },
        { studentId: 'eb-student-2', row: 0, col: 1 }
      ]
    })
    expect(project).toEqual(JSON.parse(fixture('classgraph-roundtrip-export-v1.json')))
  })

  it('reads the hand-back ClassGraph made from that export and previews it', () => {
    const handback = parseClassGraphHandback(fixture('classgraph-roundtrip-handback-v1.json'))
    const preview = previewClassGraphSeating(handback, {
      rows: 2,
      cols: 3,
      roster: [
        { id: 'eb-student-1', name: '张喆' },
        { id: 'eb-student-2', name: '李玥' },
        { id: 'eb-student-3', name: 'Lily Chen' }
      ],
      currentSeatCount: 2
    })
    expect(preview).toMatchObject({
      unknownStudentIds: [],
      gridFits: true,
      unseatedAfter: 0,
      gridNeeded: { rows: 2, cols: 3 }
    })
    expect(preview.seats.map((seat) => [seat.name, seat.row, seat.col])).toEqual([
      ['李玥', 0, 1],
      ['张喆', 1, 0],
      ['Lily Chen', 1, 2]
    ])
  })
})
