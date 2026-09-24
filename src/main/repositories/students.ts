import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { students } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { recordAudit, softDeleteAuditForStudent } from './auditLog'
import type { Student } from '@shared/types'
import type { CreateStudentInput, UpdateStudentInput } from '@shared/inputs'

export type { CreateStudentInput, UpdateStudentInput }

export function listStudents(includeArchived = false): Student[] {
  const db = getDb()
  const rows = db
    .select()
    .from(students)
    .orderBy(asc(students.lastName), asc(students.firstName))
    .all() as Student[]
  return includeArchived ? rows : rows.filter((s) => !s.archived)
}

export function getStudent(id: string): Student | undefined {
  return getDb().select().from(students).where(eq(students.id, id)).get() as Student | undefined
}

export function createStudent(input: CreateStudentInput): Student {
  const now = nowIso()
  const row: Student = { id: newId(), createdAt: now, updatedAt: now, archived: false, ...input }
  getDb().insert(students).values(row).run()
  recordAudit({
    entityType: 'student',
    entityId: row.id,
    action: 'create',
    summary: `Added student ${row.firstName} ${row.lastName}`,
    studentId: row.id
  })
  return row
}

export function updateStudent(id: string, patch: UpdateStudentInput): Student {
  getDb()
    .update(students)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(students.id, id))
    .run()
  const updated = getStudent(id)
  if (!updated) throw new Error(`Student ${id} not found after update`)
  recordAudit({
    entityType: 'student',
    entityId: id,
    action: 'update',
    summary: `Updated student ${updated.firstName} ${updated.lastName}`,
    studentId: id
  })
  return updated
}

/** Deletion itself is logged, then the student's ENTIRE audit trail (this entry
 * included) is soft-deleted in one move — a removed student's history stops showing up
 * in the log immediately, per the school's requirement, while still being recoverable
 * from a pre-deletion backup for 12 months (see auditLog.purgeOldDeletedAuditEntries and
 * the students.remove IPC handler, which takes a backup right before calling this). */
export function deleteStudent(id: string): void {
  const existing = getStudent(id)
  getDb().delete(students).where(eq(students.id, id)).run()
  if (existing) {
    recordAudit({
      entityType: 'student',
      entityId: id,
      action: 'delete',
      summary: `Removed student ${existing.firstName} ${existing.lastName}`,
      studentId: id
    })
  }
  softDeleteAuditForStudent(id)
}
