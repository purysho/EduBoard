import { and, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { auditLog } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { AuditLogAction, AuditLogEntry } from '@shared/types'

export type RecordAuditInput = {
  entityType: string
  entityId: string
  action: AuditLogAction
  summary: string
  studentId?: string | null
  classId?: string | null
}

/** Appends one entry to the audit trail — called from inside the repository function
 * that actually performs the mutation, never from the renderer, so there's no way to
 * record an action without it also having happened. Never throws: a logging failure
 * must never block the real operation it's describing. */
export function recordAudit(input: RecordAuditInput): void {
  try {
    getDb()
      .insert(auditLog)
      .values({
        id: newId(),
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        summary: input.summary,
        studentId: input.studentId ?? null,
        classId: input.classId ?? null,
        createdAt: nowIso()
      })
      .run()
  } catch (err) {
    console.error('Failed to record audit log entry:', err)
  }
}

/** The visible log — newest first, excluding anything soft-deleted (a removed student's
 * trail). Optionally scoped to one student or class. */
export function listAuditLog(filter?: { studentId?: string; classId?: string }): AuditLogEntry[] {
  const db = getDb()
  const conditions = [isNull(auditLog.deletedAt)]
  if (filter?.studentId) conditions.push(eq(auditLog.studentId, filter.studentId))
  if (filter?.classId) conditions.push(eq(auditLog.classId, filter.classId))

  return db
    .select({
      id: auditLog.id,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      action: auditLog.action,
      summary: auditLog.summary,
      studentId: auditLog.studentId,
      classId: auditLog.classId,
      createdAt: auditLog.createdAt
    })
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(1000)
    .all() as AuditLogEntry[]
}

/** Soft-deletes every entry tied to a student — called right after deleteStudent
 * actually removes the student row. The rows stay in the database (see
 * purgeOldDeletedAuditEntries) so a mistaken deletion can still be traced from a
 * pre-deletion backup; they just stop showing up in the ordinary log view. */
export function softDeleteAuditForStudent(studentId: string): void {
  getDb()
    .update(auditLog)
    .set({ deletedAt: nowIso() })
    .where(and(eq(auditLog.studentId, studentId), isNull(auditLog.deletedAt)))
    .run()
}

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000

/** Hard-deletes audit entries that have been soft-deleted for over 12 months — run once
 * at app startup (see main/index.ts), same pattern as backup.pruneAutoBackups. */
export function purgeOldDeletedAuditEntries(): void {
  const cutoff = new Date(Date.now() - TWELVE_MONTHS_MS).toISOString()
  getDb()
    .delete(auditLog)
    .where(and(isNotNull(auditLog.deletedAt), lt(auditLog.deletedAt, cutoff)))
    .run()
}
