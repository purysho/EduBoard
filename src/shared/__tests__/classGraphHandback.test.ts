import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ClassGraphHandbackError,
  parseClassGraphHandback,
  planClassGraphSeatWrites
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
    expect(() => parseClassGraphHandback(JSON.stringify(raw))).toThrow(
      /derived or synthetic data/
    )
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
