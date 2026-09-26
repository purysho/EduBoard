import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import ExcelJS from 'exceljs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass, updateClass } from '../../repositories/classes'
import { createCourseGroup } from '../../repositories/courseGroups'
import { createTerm } from '../../repositories/terms'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { exportCourseGradeSheetXlsx } from '../importExport'
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

function termClass(term: string, sortOrder: number, groupId: string): string {
  const termId = createTerm({
    name: term,
    schoolYear: '2026-2027',
    startDate: null,
    endDate: null,
    sortOrder
  }).id
  const id = createClass({
    name: 'University English',
    subject: null,
    levelType: 'university',
    gradeLevel: null,
    termId,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id
  updateClass(id, { courseGroupId: groupId })
  return id
}

describe('end-of-term course grade sheet', () => {
  it('lists each term, the combined grade, and a gradebook sheet per term', async () => {
    const group = createCourseGroup({ name: 'University English' }).id
    const term1 = termClass('Term 1', 0, group)
    const term2 = termClass('Term 2', 1, group)
    const mai = createStudent({
      firstName: 'Mai',
      lastName: 'Chen',
      preferredName: null,
      studentNumber: 'S1',
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    }).id
    for (const [cls, points] of [
      [term1, 80],
      [term2, 90]
    ] as const) {
      enrollStudent({ studentId: mai, classId: cls, enrolledOn: '2026-09-01' })
      const a = createAssessment({
        classId: cls,
        categoryId: null,
        name: 'Essay',
        description: null,
        assessmentDate: null,
        maxScore: 100
      })
      upsertScore({ assessmentId: a.id, studentId: mai, pointsEarned: points })
    }

    const file = join(tempDir, 'grades.xlsx')
    await exportCourseGradeSheetXlsx(group, file)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(file)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Final grades', 'Term 1', 'Term 2'])
    const final = wb.getWorksheet('Final grades')!
    const header = (final.getRow(1).values as unknown[]).slice(1)
    expect(header).toEqual([
      'Last Name',
      'First Name',
      'Student #',
      'Term 1 %',
      'Term 1 letter',
      'Term 2 %',
      'Term 2 letter',
      'Final %',
      'Final letter',
      'Attendance %'
    ])
    const row = (final.getRow(2).values as unknown[]).slice(1)
    expect(row.slice(0, 4)).toEqual(['Chen', 'Mai', 'S1', 80])
    expect(row[5]).toBe(90)
    expect(row[7]).toBe(85)
  })
})
