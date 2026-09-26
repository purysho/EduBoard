import { getSqlite } from '../db/client'
import { getStudent, updateStudent } from './students'
import { recordAudit } from './auditLog'
import type { Student } from '@shared/types'

/** Every table that points at a student, found from the database itself so a table
 * added later is never forgotten by a merge. */
function studentTables(): string[] {
  const db = getSqlite()
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]
  return tables
    .map((t) => t.name)
    .filter((name) => name !== 'students')
    .filter((name) =>
      (db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).some(
        (c) => c.name === 'student_id'
      )
    )
}

const FILLABLE: (keyof Student)[] = [
  'preferredName',
  'studentNumber',
  'dateOfBirth',
  'gradeLevel',
  'guardianName',
  'guardianContact',
  'email',
  'notes'
]

/**
 * Folds a duplicate student into the one being kept: classes, scores, attendance,
 * submissions, notes and links all move across, and blank details on the kept student
 * are filled from the duplicate. Where both have the same thing (a score for the same
 * test, say), the kept student's own entry wins. The duplicate is then removed.
 */
export function mergeStudents(keepId: string, duplicateId: string): Student {
  if (keepId === duplicateId) throw new Error('Pick two different students to merge.')
  const keep = getStudent(keepId)
  const dup = getStudent(duplicateId)
  if (!keep || !dup) throw new Error('One of those students no longer exists.')
  const db = getSqlite()

  db.transaction(() => {
    for (const table of studentTables()) {
      // OR IGNORE: a row the kept student already has (same class, same test…) stays
      // as it is, and the duplicate's clashing row is dropped below.
      db.prepare(`UPDATE OR IGNORE "${table}" SET student_id = ? WHERE student_id = ?`).run(
        keepId,
        duplicateId
      )
      db.prepare(`DELETE FROM "${table}" WHERE student_id = ?`).run(duplicateId)
    }
    const fill: Partial<Student> = {}
    for (const key of FILLABLE) {
      if ((keep[key] === null || keep[key] === '') && dup[key]) {
        Object.assign(fill, { [key]: dup[key] })
      }
    }
    if (Object.keys(fill).length) updateStudent(keepId, fill)
    db.prepare('DELETE FROM students WHERE id = ?').run(duplicateId)
  })()

  recordAudit({
    entityType: 'student',
    entityId: keepId,
    action: 'update',
    summary: `Merged duplicate ${dup.firstName} ${dup.lastName} into ${keep.firstName} ${keep.lastName}`,
    studentId: keepId
  })
  return getStudent(keepId)!
}
