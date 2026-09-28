// Reading a score spreadsheet for the import preview, and writing an import once the
// teacher has confirmed it. The matching in between is in @shared/scoreImport.
import ExcelJS from 'exceljs'
import { AppError } from '@shared/errorCodes'
import { tr } from '@shared/i18n'
import type { ScoreImportRequest, ScoreImportResult, ScoreSheet } from '@shared/scoreImport'
import { getSqlite } from '../db/client'
import { getClass } from '../repositories/classes'
import { createAssessment, listAssessmentsByClass } from '../repositories/assessments'
import { getRosterForClass } from '../repositories/enrollments'
import { upsertScore } from '../repositories/scores'

const MAX_ROWS = 2000
const MAX_COLUMNS = 80

/** A cell as the preview needs it: a number, text, or nothing. Formulas give their
 * result, rich text its plain text. */
function cellValue(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value as unknown
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown }
    if (o.result !== undefined) {
      return typeof o.result === 'number' ? o.result : o.result == null ? null : String(o.result)
    }
    if (Array.isArray(o.richText))
      return (
        o.richText
          .map((r) => r.text)
          .join('')
          .trim() || null
      )
    if (typeof o.text === 'string') return o.text.trim() || null
  }
  return cell.text?.trim() || null
}

/** One worksheet of a .xlsx (the first, unless another is asked for) or a .csv: row 1 as
 * the headings, then the rows below it that have anything in them. */
export async function readScoreSheet(filePath: string, sheetIndex = 0): Promise<ScoreSheet> {
  const workbook = new ExcelJS.Workbook()
  let sheet: ExcelJS.Worksheet | undefined
  try {
    if (filePath.toLowerCase().endsWith('.csv')) {
      sheet = await workbook.csv.readFile(filePath)
    } else {
      await workbook.xlsx.readFile(filePath)
      sheet = workbook.worksheets[sheetIndex] ?? workbook.worksheets[0]
    }
  } catch {
    throw new AppError(
      'EB-2002',
      tr('That file couldn’t be read as a spreadsheet. Save it as .xlsx or .csv and try again.')
    )
  }
  if (!sheet) throw new AppError('EB-2002', tr('Workbook has no sheets'))

  const width = Math.min(sheet.columnCount, MAX_COLUMNS)
  const read = (row: ExcelJS.Row): (string | number | null)[] =>
    Array.from({ length: width }, (_, i) => cellValue(row.getCell(i + 1)))
  const headers = read(sheet.getRow(1)).map((v, i) =>
    v === null ? tr('Column {n}', { n: i + 1 }) : String(v)
  )
  const rows: (string | number | null)[][] = []
  let truncated = false
  for (let r = 2; r <= sheet.rowCount; r++) {
    const values = read(sheet.getRow(r))
    if (values.every((v) => v === null)) continue
    if (rows.length >= MAX_ROWS) {
      truncated = true
      break
    }
    rows.push(values)
  }
  const names = filePath.toLowerCase().endsWith('.csv')
    ? [tr('CSV file')]
    : workbook.worksheets.map((w) => w.name)
  return {
    sheetNames: names,
    sheetIndex: Math.min(sheetIndex, names.length - 1),
    headers,
    rows,
    truncated
  }
}

/** Writes a confirmed import in one go: the new assessments, then every score (each
 * keeps its history and audit entry, as if typed in the gradebook). Nothing is written if
 * anything in it doesn't belong to the class. */
export function applyScoreImport(req: ScoreImportRequest): ScoreImportResult {
  if (!getClass(req.classId)) throw new AppError('EB-0002', tr('Class not found'))
  const ownAssessments = new Set(listAssessmentsByClass(req.classId).map((a) => a.id))
  const inClass = new Set(getRosterForClass(req.classId).map((r) => r.student.id))
  const newKeys = new Set(req.newAssessments.map((a) => a.key))
  for (const w of req.writes) {
    if (!inClass.has(w.studentId)) {
      throw new AppError('EB-0003', tr('A student in the import isn’t in this class.'))
    }
    if (!ownAssessments.has(w.target) && !newKeys.has(w.target)) {
      throw new AppError('EB-0002', tr('An assessment in the import no longer exists.'))
    }
  }
  for (const a of req.newAssessments) {
    if (!a.name.trim() || !(a.maxScore > 0)) {
      throw new AppError('EB-0004', tr('Each new assessment needs a name and a maximum above 0.'))
    }
  }

  let scoresWritten = 0
  getSqlite().transaction(() => {
    const ids = new Map<string, string>()
    for (const a of req.newAssessments) {
      const created = createAssessment({
        classId: req.classId,
        categoryId: a.categoryId,
        name: a.name.trim(),
        description: null,
        assessmentDate: a.date,
        maxScore: a.maxScore
      })
      ids.set(a.key, created.id)
    }
    for (const w of req.writes) {
      upsertScore({
        assessmentId: ids.get(w.target) ?? w.target,
        studentId: w.studentId,
        pointsEarned: w.excused ? null : w.pointsEarned,
        excused: w.excused
      })
      scoresWritten++
    }
  })()
  return { assessmentsCreated: req.newAssessments.length, scoresWritten }
}
