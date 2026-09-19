import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { assessments, assignmentSubmissions } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { AssignmentSubmission } from '@shared/types'
import type { UpsertAssignmentSubmissionInput } from '@shared/inputs'

export type { UpsertAssignmentSubmissionInput }

export function listSubmissionsByAssessment(assessmentId: string): AssignmentSubmission[] {
  return getDb()
    .select()
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.assessmentId, assessmentId))
    .all() as AssignmentSubmission[]
}

/** Every submission for every assessment in a class, in one query — used by the
 * gradebook grid instead of one query per assessment column. */
export function listSubmissionsByClass(classId: string): AssignmentSubmission[] {
  const db = getDb()
  const assessmentIds = db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.classId, classId))
    .all()
    .map((a) => a.id)
  if (assessmentIds.length === 0) return []
  return db
    .select()
    .from(assignmentSubmissions)
    .where(inArray(assignmentSubmissions.assessmentId, assessmentIds))
    .all() as AssignmentSubmission[]
}

/** One submission per (assessment, student) — a resubmission replaces the previous file
 * rather than accumulating a history, matching how a score itself is edited in place. */
export function upsertAssignmentSubmission(
  input: UpsertAssignmentSubmissionInput
): AssignmentSubmission {
  const db = getDb()
  const existing = db
    .select()
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assessmentId, input.assessmentId),
        eq(assignmentSubmissions.studentId, input.studentId)
      )
    )
    .get() as AssignmentSubmission | undefined

  const now = nowIso()

  if (existing) {
    db.update(assignmentSubmissions)
      .set({ filePath: input.filePath, fileName: input.fileName, submittedAt: now })
      .where(eq(assignmentSubmissions.id, existing.id))
      .run()
    return { ...existing, ...input, submittedAt: now }
  }

  const row: AssignmentSubmission = { id: newId(), submittedAt: now, ...input }
  db.insert(assignmentSubmissions).values(row).run()
  return row
}

export function deleteAssignmentSubmission(id: string): void {
  getDb().delete(assignmentSubmissions).where(eq(assignmentSubmissions.id, id)).run()
}
