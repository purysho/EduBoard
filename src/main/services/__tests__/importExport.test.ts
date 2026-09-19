import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { listStudents } from '../../repositories/students'
import { getRosterForClass } from '../../repositories/enrollments'
import { importRoster, exportGradebookXlsx } from '../importExport'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-import-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

const CSV = `First Name,Last Name,Student Number,Grade Level,Email
Grace,Hopper,S100,Grade 5,grace@example.com
Alan,Turing,S101,Grade 5,alan@example.com
,Missing First Name,S102,Grade 5,
`

describe('importRoster', () => {
  it('parses a CSV roster and skips rows missing a required name', async () => {
    const filePath = join(tempDir, 'roster.csv')
    writeFileSync(filePath, CSV)

    const result = await importRoster(filePath)

    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(0)

    const students = listStudents()
    expect(students.map((s) => s.lastName).sort()).toEqual(['Hopper', 'Turing'])
    expect(students.find((s) => s.lastName === 'Hopper')?.studentNumber).toBe('S100')
    expect(students.find((s) => s.lastName === 'Hopper')?.email).toBe('grace@example.com')
  })

  it('also enrolls imported students when a class id is given', async () => {
    const filePath = join(tempDir, 'roster.csv')
    writeFileSync(filePath, CSV)

    const cls = createClass({
      name: 'Grade 5 Homeroom',
      subject: null,
      levelType: 'k12',
      gradeLevel: 'Grade 5',
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })

    await importRoster(filePath, cls.id)

    const roster = getRosterForClass(cls.id)
    expect(roster).toHaveLength(2)
  })

  it('rejects a file missing the required name columns', async () => {
    const filePath = join(tempDir, 'bad.csv')
    writeFileSync(filePath, 'Email\nsomeone@example.com\n')

    await expect(importRoster(filePath)).rejects.toThrow(/First Name.*Last Name/)
  })
})

describe('exportGradebookXlsx', () => {
  it('writes a workbook with one row per student and a computed grade column', async () => {
    const filePath = join(tempDir, 'roster.csv')
    writeFileSync(filePath, CSV)

    const cls = createClass({
      name: 'Grade 5 Homeroom',
      subject: null,
      levelType: 'k12',
      gradeLevel: 'Grade 5',
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    await importRoster(filePath, cls.id)

    const students = listStudents()
    const hopper = students.find((s) => s.lastName === 'Hopper')!
    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      name: 'Quiz 1',
      description: null,
      assessmentDate: '2026-09-10',
      maxScore: 100
    })
    upsertScore({ assessmentId: assessment.id, studentId: hopper.id, pointsEarned: 88 })

    const outPath = join(tempDir, 'gradebook.xlsx')
    await exportGradebookXlsx(cls.id, outPath)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(outPath)
    const sheet = workbook.worksheets[0]

    const header = sheet.getRow(1).values as unknown[]
    expect(header).toContain('Quiz 1 (/100)')
    expect(header).toContain('Percent')

    const rows = [2, 3].map((n) => sheet.getRow(n).values as unknown[])
    const hopperRow = rows.find((r) => r.includes('Hopper'))!
    expect(hopperRow).toContain(88)
    expect(hopperRow).toContain('B')
  })
})
