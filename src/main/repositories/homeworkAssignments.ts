import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { homeworkAssignments, homeworkSubmissions } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { getRosterForClass } from './enrollments'
import type {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkSubmissionStatus,
  HomeworkSubmissionWithStudent
} from '@shared/types'
import type {
  CreateHomeworkAssignmentInput,
  SetHomeworkSubmissionGradeInput,
  SetHomeworkSubmissionStatusInput,
  UpdateHomeworkAssignmentInput
} from '@shared/inputs'

export type {
  CreateHomeworkAssignmentInput,
  UpdateHomeworkAssignmentInput,
  SetHomeworkSubmissionStatusInput,
  SetHomeworkSubmissionGradeInput
}

export function listHomeworkAssignmentsByClass(classId: string): HomeworkAssignment[] {
  return getDb()
    .select()
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.classId, classId))
    .all() as HomeworkAssignment[]
}

export function createHomeworkAssignment(input: CreateHomeworkAssignmentInput): HomeworkAssignment {
  const now = nowIso()
  const row: HomeworkAssignment = { id: newId(), createdAt: now, updatedAt: now, ...input }
  getDb().insert(homeworkAssignments).values(row).run()
  return row
}

export function updateHomeworkAssignment(
  id: string,
  patch: UpdateHomeworkAssignmentInput
): HomeworkAssignment {
  getDb()
    .update(homeworkAssignments)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(homeworkAssignments.id, id))
    .run()
  return getDb()
    .select()
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.id, id))
    .get() as HomeworkAssignment
}

export function deleteHomeworkAssignment(id: string): void {
  getDb().delete(homeworkAssignments).where(eq(homeworkAssignments.id, id)).run()
}

/** Every actively-enrolled student's submission status for one assignment — students
 * with no submission row yet default to "not_started" rather than being left out, so
 * the roster view always shows everyone, not just students who already have a row. */
export function listSubmissionsForAssignment(
  homeworkAssignmentId: string,
  classId: string
): HomeworkSubmissionWithStudent[] {
  const roster = getRosterForClass(classId).filter((r) => r.enrollment.status === 'active')
  const existing = getDb()
    .select()
    .from(homeworkSubmissions)
    .where(eq(homeworkSubmissions.homeworkAssignmentId, homeworkAssignmentId))
    .all() as HomeworkSubmission[]
  const byStudent = new Map(existing.map((s) => [s.studentId, s]))

  return roster.map(({ student }) => {
    const submission = byStudent.get(student.id)
    return {
      id: submission?.id ?? '',
      homeworkAssignmentId,
      studentId: student.id,
      status: submission?.status ?? 'not_started',
      submittedAt: submission?.submittedAt ?? null,
      updatedAt: submission?.updatedAt ?? '',
      textAnswer: submission?.textAnswer ?? null,
      fileName: submission?.fileName ?? null,
      grade: submission?.grade ?? null,
      feedback: submission?.feedback ?? null,
      gradedAt: submission?.gradedAt ?? null,
      studentName: `${student.firstName} ${student.lastName}`
    }
  })
}

/** Sets a grade/feedback the teacher entered locally — separate from setSubmissionStatus
 * since grading always implies status='done', and the caller pushes this same input up
 * to the Portal right after (see portalSyncService.pushSubmissionGrade). */
export function setSubmissionGrade(input: SetHomeworkSubmissionGradeInput): HomeworkSubmission {
  const db = getDb()
  const now = nowIso()
  const existing = db
    .select()
    .from(homeworkSubmissions)
    .where(
      and(
        eq(homeworkSubmissions.homeworkAssignmentId, input.homeworkAssignmentId),
        eq(homeworkSubmissions.studentId, input.studentId)
      )
    )
    .get() as HomeworkSubmission | undefined

  const patch = {
    status: 'done' as const,
    grade: input.grade,
    feedback: input.feedback,
    gradedAt: now,
    updatedAt: now
  }

  if (existing) {
    db.update(homeworkSubmissions).set(patch).where(eq(homeworkSubmissions.id, existing.id)).run()
    return { ...existing, ...patch }
  }

  const row: HomeworkSubmission = {
    id: newId(),
    homeworkAssignmentId: input.homeworkAssignmentId,
    studentId: input.studentId,
    submittedAt: null,
    textAnswer: null,
    fileName: null,
    ...patch
  }
  db.insert(homeworkSubmissions).values(row).run()
  return row
}

/** Mirrors a submission's full state as the Portal has it — used only when pulling from
 * the Portal (see portalSyncService.pullSubmissionsFromPortal), never by anything a
 * teacher does locally, so a student's own submitted text/file always wins over
 * whatever was here before. */
export function upsertSubmissionFromPortal(input: {
  homeworkAssignmentId: string
  studentId: string
  status: HomeworkSubmissionStatus
  submittedAt: string | null
  textAnswer: string | null
  fileName: string | null
  grade: string | null
  feedback: string | null
}): void {
  const db = getDb()
  const now = nowIso()
  const existing = db
    .select()
    .from(homeworkSubmissions)
    .where(
      and(
        eq(homeworkSubmissions.homeworkAssignmentId, input.homeworkAssignmentId),
        eq(homeworkSubmissions.studentId, input.studentId)
      )
    )
    .get() as HomeworkSubmission | undefined

  const patch = {
    status: input.status,
    submittedAt: input.submittedAt,
    textAnswer: input.textAnswer,
    fileName: input.fileName,
    grade: input.grade,
    feedback: input.feedback,
    updatedAt: now
  }

  if (existing) {
    db.update(homeworkSubmissions).set(patch).where(eq(homeworkSubmissions.id, existing.id)).run()
    return
  }
  db.insert(homeworkSubmissions)
    .values({
      id: newId(),
      homeworkAssignmentId: input.homeworkAssignmentId,
      studentId: input.studentId,
      gradedAt: null,
      ...patch
    })
    .run()
}

export function setSubmissionStatus(input: SetHomeworkSubmissionStatusInput): HomeworkSubmission {
  const db = getDb()
  const now = nowIso()
  const existing = db
    .select()
    .from(homeworkSubmissions)
    .where(
      and(
        eq(homeworkSubmissions.homeworkAssignmentId, input.homeworkAssignmentId),
        eq(homeworkSubmissions.studentId, input.studentId)
      )
    )
    .get() as HomeworkSubmission | undefined

  const submittedAt = input.status === 'not_started' ? null : (existing?.submittedAt ?? now)

  if (existing) {
    db.update(homeworkSubmissions)
      .set({ status: input.status, submittedAt, updatedAt: now })
      .where(eq(homeworkSubmissions.id, existing.id))
      .run()
    return { ...existing, status: input.status, submittedAt, updatedAt: now }
  }

  const row: HomeworkSubmission = {
    id: newId(),
    homeworkAssignmentId: input.homeworkAssignmentId,
    studentId: input.studentId,
    status: input.status,
    submittedAt,
    updatedAt: now,
    textAnswer: null,
    fileName: null,
    grade: null,
    feedback: null,
    gradedAt: null
  }
  db.insert(homeworkSubmissions).values(row).run()
  return row
}
