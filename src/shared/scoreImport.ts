// Score import: scores from an exam system's or colleague's spreadsheet, matched to a
// class's students and assessments, previewed, and only then written to the gradebook.
// Everything here is pure (the file is read in the main process, and written there too
// once the teacher confirms), so the matching can be tested on its own.

/** A worksheet as read from the file: row 1's headings, then every row's cells. */
export interface ScoreSheet {
  sheetNames: string[]
  sheetIndex: number
  headers: string[]
  rows: (string | number | null)[][]
  /** The file had more rows than are read (only the first ones are). */
  truncated: boolean
}

export interface ImportStudent {
  id: string
  firstName: string
  lastName: string
  studentNumber: string | null
}

export interface ImportAssessment {
  id: string
  name: string
  maxScore: number
}

/** Where the students are in the sheet. */
export type StudentColumns =
  | { kind: 'number'; column: number }
  | { kind: 'name'; column: number }
  | { kind: 'split'; first: number; last: number }

/** One score column and where its scores go. */
export interface ScoreColumnChoice {
  column: number
  include: boolean
  /** An existing assessment's id, or 'new' to create one named `newName`. */
  target: string
  newName: string
  maxScore: number
}

const NUMBER_HEADERS = [
  'student number',
  'student no',
  'student id',
  'id',
  'no.',
  'number',
  '学号',
  '考号',
  '编号'
]
const NAME_HEADERS = ['name', 'full name', 'student name', 'student', '姓名', '学生姓名', '学生']
const FIRST_HEADERS = ['first name', 'firstname', 'first', 'given name', '名', '名字']
const LAST_HEADERS = ['last name', 'lastname', 'last', 'surname', 'family name', '姓', '姓氏']

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
const findHeader = (headers: string[], names: string[]): number =>
  headers.findIndex((h) => names.includes(norm(h)))

/** The student columns, from the headings: a student number if there is one with
 * numbers in it (the most reliable match), else a name column, else first and last name
 * columns. `prefer` asks for one kind, e.g. when the teacher picks it. */
export function guessStudentColumns(
  headers: string[],
  rows: (string | number | null)[][] = [],
  prefer?: StudentColumns['kind']
): StudentColumns | null {
  const filled = (col: number): boolean =>
    !rows.length ||
    rows.filter((r) => r[col] !== null && r[col] !== undefined && String(r[col]).trim()).length >=
      rows.length / 2
  const number = findHeader(headers, NUMBER_HEADERS)
  const name = findHeader(headers, NAME_HEADERS)
  const first = findHeader(headers, FIRST_HEADERS)
  const last = findHeader(headers, LAST_HEADERS)
  const options: Record<StudentColumns['kind'], StudentColumns | null> = {
    number: number >= 0 && filled(number) ? { kind: 'number', column: number } : null,
    name: name >= 0 && filled(name) ? { kind: 'name', column: name } : null,
    split: first >= 0 && last >= 0 ? { kind: 'split', first, last } : null
  }
  if (prefer) return options[prefer]
  return options.number ?? options.name ?? options.split
}

const EXCUSED = ['ex', 'exc', 'excused', '免考', '免']

/** A cell as a score: a number (a percentage like "85%" becomes points out of the
 * maximum), excused, empty, or something that isn't a score. */
export function parseScore(
  cell: string | number | null,
  maxScore: number
): { kind: 'score'; points: number } | { kind: 'excused' } | { kind: 'empty' } | { kind: 'bad' } {
  if (cell === null || cell === undefined) return { kind: 'empty' }
  if (typeof cell === 'number')
    return Number.isFinite(cell) ? { kind: 'score', points: cell } : { kind: 'bad' }
  const text = cell.trim()
  if (!text || text === '-' || text === '—') return { kind: 'empty' }
  if (EXCUSED.includes(text.toLowerCase())) return { kind: 'excused' }
  const pct = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(text)
  if (pct) return { kind: 'score', points: Math.round(Number(pct[1]) * maxScore) / 100 }
  if (/^-?\d+(?:[.,]\d+)?$/.test(text))
    return { kind: 'score', points: Number(text.replace(',', '.')) }
  return { kind: 'bad' }
}

/** A heading's own maximum, as in "Quiz 3 (/20)", "Quiz 3 /20", "Quiz 3 (out of 20)" or
 * "测验（满分20）", and the name without it. */
export function splitHeading(header: string): { name: string; max: number | null } {
  const m = /^(.*?)[\s(（]*(?:\/|out of|满分)\s*(\d+(?:\.\d+)?)\s*[)）]?\s*$/i.exec(header.trim())
  if (m && m[1].trim()) return { name: m[1].trim(), max: Number(m[2]) }
  return { name: header.trim(), max: null }
}

/** The usual maximum a column's scores suggest: 10, 20, 50 or 100, or the top score. */
function guessMax(values: number[]): number {
  const top = Math.max(0, ...values)
  for (const m of [10, 20, 50, 100]) if (top <= m) return m
  return Math.ceil(top)
}

/** The columns that hold scores (most of their filled cells are scores), each matched to
 * an assessment of the same name if there is one, otherwise a new one. */
export function guessScoreColumns(
  sheet: ScoreSheet,
  students: StudentColumns,
  assessments: ImportAssessment[]
): ScoreColumnChoice[] {
  const studentCols = new Set(
    students.kind === 'split' ? [students.first, students.last] : [students.column]
  )
  const choices: ScoreColumnChoice[] = []
  sheet.headers.forEach((header, column) => {
    if (studentCols.has(column) || !header.trim()) return
    const cells = sheet.rows.map((r) => r[column] ?? null)
    const parsed = cells.map((c) => parseScore(c, 100)).filter((p) => p.kind !== 'empty')
    const scores = parsed.filter((p) => p.kind === 'score' || p.kind === 'excused')
    if (!parsed.length || scores.length / parsed.length < 0.6) return
    const { name, max } = splitHeading(header)
    // Same name, and not a different maximum in the heading ("Unit test (/50)" is not the
    // gradebook's "Unit test" out of 100).
    const existing = assessments.find(
      (a) => norm(a.name) === norm(name) && (max === null || a.maxScore === max)
    )
    const numbers = parsed.flatMap((p) => (p.kind === 'score' ? [p.points] : []))
    choices.push({
      column,
      include: true,
      target: existing?.id ?? 'new',
      newName: name,
      maxScore: existing?.maxScore ?? max ?? guessMax(numbers)
    })
  })
  return choices
}

/** Matches each row to a student: by student number, or by name in any usual order
 * ("Mai Chen", "Chen Mai", "Chen, Mai", "陈麦"), ignoring case and spaces. */
export function matchStudents(
  sheet: ScoreSheet,
  columns: StudentColumns,
  roster: ImportStudent[]
): (string | null)[] {
  const byNumber = new Map<string, string>()
  const byName = new Map<string, string | null>() // null: two students share the name
  const addName = (key: string, id: string): void => {
    const k = key.replace(/[\s,，]+/g, '').toLowerCase()
    if (!k) return
    byName.set(k, byName.has(k) && byName.get(k) !== id ? null : id)
  }
  for (const s of roster) {
    if (s.studentNumber?.trim()) byNumber.set(s.studentNumber.trim().toLowerCase(), s.id)
    addName(s.firstName + s.lastName, s.id)
    addName(s.lastName + s.firstName, s.id)
  }
  const text = (row: (string | number | null)[], col: number): string =>
    row[col] === null || row[col] === undefined ? '' : String(row[col]).trim()
  return sheet.rows.map((row) => {
    if (columns.kind === 'number') {
      return byNumber.get(text(row, columns.column).toLowerCase()) ?? null
    }
    const raw =
      columns.kind === 'name'
        ? text(row, columns.column)
        : text(row, columns.first) + text(row, columns.last)
    const key = raw.replace(/[\s,，]+/g, '').toLowerCase()
    return key ? (byName.get(key) ?? null) : null
  })
}

/** What an import will do, for the preview and then for writing. */
export interface ScoreImportPlan {
  /** Scores to write. `target` is an assessment id or `new:<column>`. */
  writes: {
    target: string
    studentId: string
    pointsEarned: number | null
    excused: boolean
    /** The score it replaces, if the student already has one there. */
    previous: number | null | 'excused'
  }[]
  /** Rows that couldn't be matched to a student, with what the sheet says. */
  unmatched: { row: number; label: string }[]
  /** Two rows for the same student: only the first is used. */
  duplicates: { row: number; label: string }[]
  /** Cells that were left out, and why. */
  skipped: {
    row: number
    column: string
    value: string
    reason: 'not-a-score' | 'over-max' | 'negative'
  }[]
}

export function buildScoreImportPlan(
  sheet: ScoreSheet,
  columns: StudentColumns,
  choices: ScoreColumnChoice[],
  roster: ImportStudent[],
  existingScores: {
    assessmentId: string
    studentId: string
    pointsEarned: number | null
    excused: boolean
  }[]
): ScoreImportPlan {
  const matches = matchStudents(sheet, columns, roster)
  const existing = new Map(existingScores.map((s) => [`${s.assessmentId}:${s.studentId}`, s]))
  const plan: ScoreImportPlan = { writes: [], unmatched: [], duplicates: [], skipped: [] }
  const seen = new Set<string>()
  const label = (row: (string | number | null)[]): string =>
    (columns.kind === 'split' ? [row[columns.first], row[columns.last]] : [row[columns.column]])
      .filter((v) => v !== null && v !== undefined && String(v).trim())
      .join(' ')
  const used = choices.filter((c) => c.include)

  sheet.rows.forEach((row, i) => {
    const rowNumber = i + 2 // the heading is row 1
    const hasAnyScore = used.some(
      (c) => parseScore(row[c.column] ?? null, c.maxScore).kind !== 'empty'
    )
    const studentId = matches[i]
    if (!studentId) {
      if (label(row) || hasAnyScore)
        plan.unmatched.push({ row: rowNumber, label: label(row) || '—' })
      return
    }
    if (seen.has(studentId)) {
      plan.duplicates.push({ row: rowNumber, label: label(row) })
      return
    }
    seen.add(studentId)
    for (const c of used) {
      const cell = row[c.column] ?? null
      const value = parseScore(cell, c.maxScore)
      const header = sheet.headers[c.column]
      if (value.kind === 'empty') continue
      if (value.kind === 'bad') {
        plan.skipped.push({
          row: rowNumber,
          column: header,
          value: String(cell),
          reason: 'not-a-score'
        })
        continue
      }
      if (value.kind === 'score' && value.points < 0) {
        plan.skipped.push({
          row: rowNumber,
          column: header,
          value: String(cell),
          reason: 'negative'
        })
        continue
      }
      if (value.kind === 'score' && value.points > c.maxScore) {
        plan.skipped.push({
          row: rowNumber,
          column: header,
          value: String(cell),
          reason: 'over-max'
        })
        continue
      }
      const target = c.target === 'new' ? `new:${c.column}` : c.target
      const old = c.target === 'new' ? undefined : existing.get(`${c.target}:${studentId}`)
      plan.writes.push({
        target,
        studentId,
        pointsEarned: value.kind === 'score' ? value.points : null,
        excused: value.kind === 'excused',
        previous: old ? (old.excused ? 'excused' : old.pointsEarned) : null
      })
    }
  })
  return plan
}

/** What the main process needs to write an import: the new assessments, then the scores. */
export interface ScoreImportRequest {
  classId: string
  newAssessments: {
    key: string
    name: string
    maxScore: number
    categoryId: string | null
    date: string | null
  }[]
  writes: { target: string; studentId: string; pointsEarned: number | null; excused: boolean }[]
}

export interface ScoreImportResult {
  assessmentsCreated: number
  scoresWritten: number
}
