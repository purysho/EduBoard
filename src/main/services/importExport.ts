import { writeFile } from 'fs/promises'
import ExcelJS from 'exceljs'
import { getSqlite } from '../db/client'
import { createStudent } from '../repositories/students'
import { enrollStudent, getRosterForClass } from '../repositories/enrollments'
import { getClass, listClassesByCourseGroup } from '../repositories/classes'
import { getTerm } from '../repositories/terms'
import { getCourseGroupComposite } from './compositeGrades'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listScoresByClass } from '../repositories/scores'
import { listAttendanceByClass } from '../repositories/attendanceRecords'
import { listSubmissionsForAssignment } from '../repositories/homeworkAssignments'
import { getClassRoster } from './reports'
import type { RosterImportResult } from '@shared/importExportTypes'
import { getSettings } from '../repositories/settingsRepo'
import type { StudentField } from '@shared/types'
import { tr } from '@shared/i18n'

// Column name -> accepted header aliases (case-insensitive, matched against row 1).
// Chinese class lists usually have one 姓名 (full name) column instead of two.
const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ['first name', 'firstname', 'first', 'given name', '名', '名字'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name', '姓', '姓氏'],
  fullName: ['name', 'full name', 'student name', '姓名', '学生姓名'],
  studentNumber: ['student number', 'student id', 'id', 'student no', 'studentid', '学号'],
  gradeLevel: ['grade level', 'grade', 'year', 'major', 'major / cohort', 'cohort', '年级', '班级'],
  email: ['email', 'e-mail', '邮箱', '电子邮箱'],
  guardianName: ['guardian name', 'parent name', 'guardian', '家长姓名', '监护人', '家长'],
  guardianContact: [
    'guardian contact',
    'parent contact',
    'phone',
    'contact',
    '家长电话',
    '联系电话',
    '联系方式',
    '电话'
  ],
  notes: ['notes', 'note', '备注']
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/

/** Splits a full name: a Chinese name's first character is the family name ("陈麦"
 * is 陈 + 麦); otherwise the last word is ("Mai Chen" is Mai + Chen). */
export function splitFullName(full: string): { firstName: string; lastName: string } | null {
  const name = full.trim().replace(/\s+/g, ' ')
  if (!name) return null
  if (CJK.test(name) && !name.includes(' ')) {
    return name.length < 2 ? null : { lastName: name[0], firstName: name.slice(1) }
  }
  const at = name.lastIndexOf(' ')
  if (at < 0) return null
  return { firstName: name.slice(0, at), lastName: name.slice(at + 1) }
}

async function loadFirstWorksheet(filePath: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook()
  if (filePath.toLowerCase().endsWith('.csv')) {
    return workbook.csv.readFile(filePath)
  }
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error(tr('Workbook has no sheets'))
  return sheet
}

/** Column number per built-in field, and per custom field id (as `custom:<id>`) for a
 * column named like one of the teacher's own student fields. */
function buildHeaderIndex(
  headerRow: ExcelJS.Row,
  customFields: StudentField[] = []
): Map<string, number> {
  const map = new Map<string, number>()
  headerRow.eachCell((cell, colNumber) => {
    const raw = String(cell.value ?? '')
      .trim()
      .toLowerCase()
    if (!raw) return
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(raw)) map.set(field, colNumber)
    }
    for (const f of customFields) {
      if (f.label.trim().toLowerCase() === raw) map.set(`custom:${f.id}`, colNumber)
    }
  })
  return map
}

function cellText(row: ExcelJS.Row, colNumber: number | undefined): string | null {
  if (!colNumber) return null
  const value = row.getCell(colNumber).value
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

/**
 * Imports a roster from a .xlsx or .csv file. Requires "First Name" and "Last Name"
 * columns (a few common header spellings are accepted); everything else is optional.
 * When classId is given, each imported student is also enrolled in that class.
 */
export async function importRoster(
  filePath: string,
  classId?: string
): Promise<RosterImportResult> {
  const worksheet = await loadFirstWorksheet(filePath)
  const headerRow = worksheet.getRow(1)
  const customFields = getSettings().studentFields
  const headerIndex = buildHeaderIndex(headerRow, customFields)

  const splitNames = !(headerIndex.has('firstName') && headerIndex.has('lastName'))
  if (splitNames && !headerIndex.has('fullName')) {
    throw new Error(
      tr('The file needs “First Name” and “Last Name” columns, or one “Name” (姓名) column.')
    )
  }

  const result: RosterImportResult = { imported: 0, skipped: 0, errors: [] }
  const today = new Date().toISOString().slice(0, 10)

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const split = splitNames
      ? splitFullName(cellText(row, headerIndex.get('fullName')) ?? '')
      : null
    const firstName = splitNames
      ? (split?.firstName ?? null)
      : cellText(row, headerIndex.get('firstName'))
    const lastName = splitNames
      ? (split?.lastName ?? null)
      : cellText(row, headerIndex.get('lastName'))
    if (!firstName || !lastName) {
      result.skipped++
      return
    }

    try {
      const student = createStudent({
        firstName,
        lastName,
        preferredName: null,
        studentNumber: cellText(row, headerIndex.get('studentNumber')),
        dateOfBirth: null,
        gradeLevel: cellText(row, headerIndex.get('gradeLevel')),
        guardianName: cellText(row, headerIndex.get('guardianName')),
        guardianContact: cellText(row, headerIndex.get('guardianContact')),
        email: cellText(row, headerIndex.get('email')),
        notes: cellText(row, headerIndex.get('notes')),
        customFields: Object.fromEntries(
          customFields
            .map((f) => [f.id, cellText(row, headerIndex.get(`custom:${f.id}`))])
            .filter((pair): pair is [string, string] => !!pair[1])
        )
      })
      if (classId) {
        enrollStudent({ studentId: student.id, classId, enrolledOn: today })
      }
      result.imported++
    } catch (error) {
      result.errors.push(
        tr('Row {row}: {message}', { row: rowNumber, message: (error as Error).message })
      )
    }
  })

  return result
}

/** Exports a class's full gradebook (every assessment column + computed grade) to .xlsx. */
export async function exportGradebookXlsx(classId: string, filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  addGradebookSheet(workbook, classId)
  await workbook.xlsx.writeFile(filePath)
}

/** One class's gradebook (every assessment score, percent and letter) as a worksheet. */
function addGradebookSheet(workbook: ExcelJS.Workbook, classId: string, sheetName?: string): void {
  const cls = getClass(classId)
  if (!cls) throw new Error(tr('Class not found'))

  const assessmentsList = listAssessmentsByClass(classId)
  const scoresByKey = new Map(
    listScoresByClass(classId).map((s) => [`${s.assessmentId}:${s.studentId}`, s])
  )
  const roster = getClassRoster(classId)

  const sheet = workbook.addWorksheet(uniqueSheetName(workbook, sheetName ?? cls.name))

  sheet.addRow([
    tr('Last Name'),
    tr('First Name'),
    tr('Student #'),
    ...assessmentsList.map((a) => `${a.name} (/${a.maxScore})`),
    tr('Percent'),
    tr('Letter')
  ])
  sheet.getRow(1).font = { bold: true }

  for (const row of roster) {
    sheet.addRow([
      row.student.lastName,
      row.student.firstName,
      row.student.studentNumber ?? '',
      ...assessmentsList.map(
        (a) => scoresByKey.get(`${a.id}:${row.student.id}`)?.pointsEarned ?? ''
      ),
      row.grade.percent !== null ? Math.round(row.grade.percent * 10) / 10 : '',
      row.grade.letter ?? ''
    ])
  }

  sheet.columns.forEach((col) => {
    col.width = 16
  })
}

/** Excel sheet names: at most 31 characters, none of \ / ? * [ ] :, and unique. */
function uniqueSheetName(workbook: ExcelJS.Workbook, wanted: string): string {
  const base =
    wanted
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 28) || 'Sheet'
  let name = base
  for (let n = 2; workbook.getWorksheet(name); n++) name = `${base} ${n}`
  return name
}

const pct = (v: number | null | undefined): number | string =>
  v === null || v === undefined ? '' : Math.round(v * 10) / 10

/**
 * The end-of-term sheet for a course taught over several terms: a Final grades sheet
 * (each student's grade in every term, their combined grade, and attendance), then each
 * term's full gradebook on its own sheet. Ready to hand to a registrar.
 */
export async function exportCourseGradeSheetXlsx(
  courseGroupId: string,
  filePath: string
): Promise<void> {
  const composite = getCourseGroupComposite(courseGroupId)
  const classesInGroup = listClassesByCourseGroup(courseGroupId)
  if (!classesInGroup.length) throw new Error(tr('This course has no classes yet.'))
  // Same term order the Composite Grades page uses.
  const order = new Map<string, number>()
  for (const entry of composite.flatMap((c) => c.classes)) {
    if (!order.has(entry.classId)) order.set(entry.classId, order.size)
  }
  const classes = [...classesInGroup].sort(
    (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)
  )
  const label = (c: (typeof classes)[number]): string => {
    const term = c.termId ? getTerm(c.termId)?.name : null
    return term ? `${term}` : c.name
  }
  const students = new Map(
    classes.flatMap((c) => getRosterForClass(c.id).map((r) => [r.student.id, r.student] as const))
  )
  const attendanceByClass = new Map(
    classes.map((c) => [
      c.id,
      new Map(getClassRoster(c.id).map((r) => [r.student.id, r.attendanceRate]))
    ])
  )

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(tr('Final grades'))
  sheet.addRow([
    tr('Last Name'),
    tr('First Name'),
    tr('Student #'),
    ...classes.flatMap((c) => [`${label(c)} %`, `${label(c)} letter`]),
    tr('Final %'),
    tr('Final letter'),
    tr('Attendance %')
  ])
  sheet.getRow(1).font = { bold: true }

  const rows = [...composite].sort((a, b) => {
    const sa = students.get(a.studentId)
    const sb = students.get(b.studentId)
    return `${sa?.lastName} ${sa?.firstName}`.localeCompare(`${sb?.lastName} ${sb?.firstName}`)
  })
  for (const row of rows) {
    const student = students.get(row.studentId)
    const byClass = new Map(row.classes.map((e) => [e.classId, e]))
    // Attendance: the average of each term's rate.
    const rates = classes
      .map((c) => attendanceByClass.get(c.id)?.get(row.studentId))
      .filter((r): r is number => typeof r === 'number')
    sheet.addRow([
      student?.lastName ?? '',
      student?.firstName ?? row.studentName,
      student?.studentNumber ?? '',
      ...classes.flatMap((c) => {
        const e = byClass.get(c.id)
        return [pct(e?.percent), e?.letter ?? '']
      }),
      pct(row.compositePercent),
      row.compositeLetter ?? '',
      rates.length ? pct((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : ''
    ])
  }
  sheet.columns.forEach((col, i) => {
    col.width = i < 2 ? 18 : 14
  })
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]

  for (const c of classes) addGradebookSheet(workbook, c.id, label(c))
  await workbook.xlsx.writeFile(filePath)
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Exports a class's attendance grid (every date column, one status per cell) to .csv —
 * useful for handing raw attendance data to an administrator who just wants the numbers,
 * without opening the app. */
export async function exportAttendanceCsv(classId: string, filePath: string): Promise<void> {
  const cls = getClass(classId)
  if (!cls) throw new Error(tr('Class not found'))

  const roster = getClassRoster(classId)
  const records = listAttendanceByClass(classId)
  const dates = Array.from(new Set(records.map((r) => r.date))).sort()

  const statusByKey = new Map(records.map((r) => [`${r.studentId}:${r.date}`, r.status]))

  const lines: string[] = []
  lines.push([tr('Last Name'), tr('First Name'), tr('Student #'), ...dates].map(csvField).join(','))
  for (const row of roster) {
    lines.push(
      [
        row.student.lastName,
        row.student.firstName,
        row.student.studentNumber ?? '',
        ...dates.map((d) => statusByKey.get(`${row.student.id}:${d}`) ?? '')
      ]
        .map(csvField)
        .join(',')
    )
  }

  await writeFile(filePath, lines.join('\n'), 'utf-8')
}

/** Exports one assignment's full roster of submissions (status, text, grade, feedback)
 * to .csv — for a school that wants paper/spreadsheet records of who turned in what. */
export async function exportHomeworkSubmissionsCsv(
  homeworkAssignmentId: string,
  classId: string,
  filePath: string
): Promise<void> {
  const submissions = listSubmissionsForAssignment(homeworkAssignmentId, classId)

  const lines: string[] = []
  lines.push(
    ['Student', 'Status', 'Submitted answer', 'File', 'Grade', 'Feedback'].map(csvField).join(',')
  )
  for (const s of submissions) {
    lines.push(
      [
        s.studentName,
        s.status,
        s.textAnswer ?? '',
        s.fileName ?? '',
        s.grade ?? '',
        s.feedback ?? ''
      ]
        .map(csvField)
        .join(',')
    )
  }

  await writeFile(filePath, lines.join('\n'), 'utf-8')
}

/** Tables left out of "Export everything": settings hold the Portal secret and AI and
 * email passwords, and the migrations table is EduBoard's own bookkeeping. */
const EXPORT_SKIP = new Set(['settings', '_migrations'])

/** Everything EduBoard holds, as one Excel workbook with a sheet per table, for handing
 * over at the end of a year or to a school office. It isn't a backup: EduBoard can't
 * restore from it. Returns the number of sheets written. */
export async function exportEverythingXlsx(filePath: string): Promise<number> {
  const sqlite = getSqlite()
  const tables = (
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[]
  )
    .map((t) => t.name)
    .filter((n) => !EXPORT_SKIP.has(n))
  const workbook = new ExcelJS.Workbook()
  for (const table of tables) {
    const columns = (
      sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
    ).map((c) => c.name)
    const sheet = workbook.addWorksheet(table.slice(0, 31))
    sheet.addRow(columns).font = { bold: true }
    for (const row of sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<
      string,
      unknown
    >[]) {
      sheet.addRow(columns.map((c) => (row[c] instanceof Buffer ? '' : row[c])))
    }
  }
  await workbook.xlsx.writeFile(filePath)
  return tables.length
}
