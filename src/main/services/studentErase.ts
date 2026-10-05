// Everything EduBoard holds about one student: gathered for them (a copy of their data),
// or erased for good. An ordinary delete keeps an audit trail for a year and takes a
// backup first so a mistake can be undone; erasing is for when a student or family asks
// for their data to be removed, so it keeps neither.
import { AppError } from '@shared/errorCodes'
import { existsSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getSqlite } from '../db/client'
import { recordAudit } from '../repositories/auditLog'
import { listBackups } from './backup'
import { tr } from '@shared/i18n'
import { normalizeStudentName, studentNameKeys } from '@shared/studyProgress'

type Row = Record<string, unknown>

/** Every table with a student_id column, read from the database itself so a table added
 * later is covered without anyone remembering to list it here. */
function tablesWithStudentId(): string[] {
  const sqlite = getSqlite()
  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_migrations'"
    )
    .all() as { name: string }[]
  return tables
    .map((t) => t.name)
    .filter((name) =>
      (sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).some(
        (c) => c.name === 'student_id'
      )
    )
    .sort()
}

function studentRow(studentId: string): Row | undefined {
  return getSqlite().prepare('SELECT * FROM students WHERE id = ?').get(studentId) as
    Row | undefined
}

/** Exit ticket answers from before names came from the roster carry only a typed name. */
function unlinkedExitTicketAnswers(student: Row): Row[] {
  const name = `${student.first_name} ${student.last_name}`
  return getSqlite()
    .prepare(
      'SELECT * FROM exit_ticket_responses WHERE student_id IS NULL AND lower(trim(student_name)) = lower(?)'
    )
    .all(name) as Row[]
}

/** Offline Study Pack progress returns are linked to a student only when exactly one
 * roster name matches; the rest keep just the typed name, which is still theirs. */
function unlinkedStudyProgress(student: Row): Row[] {
  const keys = studentNameKeys({
    firstName: String(student.first_name ?? ''),
    lastName: String(student.last_name ?? ''),
    preferredName: student.preferred_name as string | null
  })
  return (
    getSqlite()
      .prepare('SELECT * FROM study_progress_returns WHERE student_id IS NULL')
      .all() as Row[]
  ).filter((row) => keys.includes(normalizeStudentName(String(row.student_name ?? ''))))
}

export interface StudentDataExport {
  exportedAt: string
  student: Row
  /** Table name → that table's rows about this student. */
  records: Record<string, Row[]>
}

export function exportStudentData(studentId: string): StudentDataExport {
  const student = studentRow(studentId)
  if (!student) throw new AppError('EB-0002', tr('That student no longer exists.'))
  const records: Record<string, Row[]> = {}
  for (const table of tablesWithStudentId()) {
    const rows = getSqlite()
      .prepare(`SELECT * FROM "${table}" WHERE student_id = ?`)
      .all(studentId) as Row[]
    if (rows.length) records[table] = rows
  }
  const typed = unlinkedExitTicketAnswers(student)
  if (typed.length)
    records.exit_ticket_responses = [...(records.exit_ticket_responses ?? []), ...typed]
  const progress = unlinkedStudyProgress(student)
  if (progress.length)
    records.study_progress_returns = [...(records.study_progress_returns ?? []), ...progress]
  return { exportedAt: new Date().toISOString(), student, records }
}

export interface EraseResult {
  rowsErased: number
  /** Backups made before now, which still contain the student until they're deleted. */
  olderBackups: number
}

export function eraseStudent(studentId: string): EraseResult {
  const sqlite = getSqlite()
  const student = studentRow(studentId)
  if (!student) throw new AppError('EB-0002', tr('That student no longer exists.'))
  let rowsErased = 0
  sqlite.transaction(() => {
    const typedIds = unlinkedExitTicketAnswers(student).map((r) => r.id as string)
    for (const id of typedIds) {
      rowsErased += sqlite.prepare('DELETE FROM exit_ticket_responses WHERE id = ?').run(id).changes
    }
    for (const row of unlinkedStudyProgress(student)) {
      rowsErased += sqlite
        .prepare('DELETE FROM study_progress_returns WHERE id = ?')
        .run(row.id).changes
    }
    for (const table of tablesWithStudentId()) {
      rowsErased += sqlite
        .prepare(`DELETE FROM "${table}" WHERE student_id = ?`)
        .run(studentId).changes
    }
    rowsErased += sqlite.prepare('DELETE FROM students WHERE id = ?').run(studentId).changes
  })()
  // What's left in the log says a student was erased, not who.
  recordAudit({
    entityType: 'student',
    entityId: 'erased',
    action: 'delete',
    summary: tr('Erased all records of a student at their request')
  })
  // SQLite keeps deleted rows in free pages of the file until they're reused; rebuild the
  // file so the erased data is really gone from it.
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
  sqlite.exec('VACUUM')
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
  removeDownloadedFiles(studentId)
  return { rowsErased, olderBackups: listBackups().length }
}

/** Files of theirs opened from the Portal are cached in a temp folder, named by id. */
function removeDownloadedFiles(studentId: string): void {
  const dir = join(tmpdir(), 'eduboard-submissions')
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    if (f.startsWith(`${studentId}-`)) rmSync(join(dir, f), { force: true })
  }
}
