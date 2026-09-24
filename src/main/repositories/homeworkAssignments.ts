import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { classes, homeworkAssignments, homeworkSubmissions } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { getRosterForClass } from './enrollments'
import { recordAudit } from './auditLog'
import type {
  HomeworkAssignment,
  HomeworkAssignmentWithClass,
  HomeworkSubmission,
  HomeworkSubmissionStatus,
  HomeworkSubmissionWithStudent
} from '@shared/types'
import type {
  CreateHomeworkAssignmentInput,
  SetHomeworkSubmissionGradeInput,
  SetHomeworkSubmissionPortfolioInput,
  SetHomeworkSubmissionStatusInput,
  UpdateHomeworkAssignmentInput
} from '@shared/inputs'

export type {
  CreateHomeworkAssignmentInput,
  UpdateHomeworkAssignmentInput,
  SetHomeworkSubmissionStatusInput,
  SetHomeworkSubmissionGradeInput,
  SetHomeworkSubmissionPortfolioInput
}

export function listHomeworkAssignmentsByClass(classId: string): HomeworkAssignment[] {
  return getDb()
    .select()
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.classId, classId))
    .all() as HomeworkAssignment[]
}

/** Every assignment across every class, with its class name/color attached — the source
 * for the Calendar view, which needs to show due dates across all classes at once
 * rather than one class at a time like the Homework tab does. */
export function listAllHomeworkAssignments(): HomeworkAssignmentWithClass[] {
  return getDb()
    .select({
      id: homeworkAssignments.id,
      classId: homeworkAssignments.classId,
      title: homeworkAssignments.title,
      description: homeworkAssignments.description,
      dueDate: homeworkAssignments.dueDate,
      filePath: homeworkAssignments.filePath,
      fileName: homeworkAssignments.fileName,
      topic: homeworkAssignments.topic,
      createdAt: homeworkAssignments.createdAt,
      updatedAt: homeworkAssignments.updatedAt,
      className: classes.name,
      classColor: classes.color
    })
    .from(homeworkAssignments)
    .innerJoin(classes, eq(classes.id, homeworkAssignments.classId))
    .all() as HomeworkAssignmentWithClass[]
}

export function createHomeworkAssignment(input: CreateHomeworkAssignmentInput): HomeworkAssignment {
  const now = nowIso()
  const row: HomeworkAssignment = { id: newId(), createdAt: now, updatedAt: now, ...input }
  getDb().insert(homeworkAssignments).values(row).run()
  recordAudit({
    entityType: 'homeworkAssignment',
    entityId: row.id,
    action: 'create',
    summary: `Created assignment "${row.title}"`,
    classId: row.classId
  })
  return row
}

export function updateHomeworkAssignment(
  id: string,
  patch: UpdateHomeworkAssignmentInput
): HomeworkAssignment {
  const before = getDb()
    .select()
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.id, id))
    .get() as HomeworkAssignment | undefined
  getDb()
    .update(homeworkAssignments)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(homeworkAssignments.id, id))
    .run()
  const updated = getDb()
    .select()
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.id, id))
    .get() as HomeworkAssignment
  // A status flip is the one change worth calling out specifically — everything else
  // (title/description/due date edits) is just "updated," but publishing is the exact
  // moment work becomes visible to students, which is what a school would want traced.
  const summary =
    before && before.status !== updated.status
      ? updated.status === 'published'
        ? `Published assignment "${updated.title}" to students`
        : `Unpublished assignment "${updated.title}"`
      : `Updated assignment "${updated.title}"`
  recordAudit({
    entityType: 'homeworkAssignment',
    entityId: id,
    action: 'update',
    summary,
    classId: updated.classId
  })
  return updated
}

export function deleteHomeworkAssignment(id: string): void {
  const existing = getDb()
    .select()
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.id, id))
    .get() as HomeworkAssignment | undefined
  getDb().delete(homeworkAssignments).where(eq(homeworkAssignments.id, id)).run()
  if (existing) {
    recordAudit({
      entityType: 'homeworkAssignment',
      entityId: id,
      action: 'delete',
      summary: `Deleted assignment "${existing.title}"`,
      classId: existing.classId
    })
  }
}

export function getHomeworkAssignment(id: string): HomeworkAssignment | undefined {
  return getDb().select().from(homeworkAssignments).where(eq(homeworkAssignments.id, id)).get() as
    HomeworkAssignment | undefined
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
      portfolio: submission?.portfolio ?? false,
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

  let result: HomeworkSubmission
  if (existing) {
    db.update(homeworkSubmissions).set(patch).where(eq(homeworkSubmissions.id, existing.id)).run()
    result = { ...existing, ...patch }
  } else {
    const row: HomeworkSubmission = {
      id: newId(),
      homeworkAssignmentId: input.homeworkAssignmentId,
      studentId: input.studentId,
      submittedAt: null,
      textAnswer: null,
      fileName: null,
      portfolio: false,
      ...patch
    }
    db.insert(homeworkSubmissions).values(row).run()
    result = row
  }

  const assignment = getDb()
    .select({ title: homeworkAssignments.title, classId: homeworkAssignments.classId })
    .from(homeworkAssignments)
    .where(eq(homeworkAssignments.id, input.homeworkAssignmentId))
    .get() as { title: string; classId: string } | undefined
  recordAudit({
    entityType: 'homeworkSubmission',
    entityId: `${input.homeworkAssignmentId}:${input.studentId}`,
    action: existing ? 'update' : 'create',
    summary: `Graded "${assignment?.title ?? 'assignment'}": ${input.grade ?? 'no grade'}`,
    studentId: input.studentId,
    classId: assignment?.classId ?? null
  })
  return result
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
      portfolio: false,
      ...patch
    })
    .run()
}

/** Toggles whether a graded submission is kept in the student's Portal-visible
 * Portfolio — a teacher's curated pick of their best work, separate from the full
 * list of graded assignments. Pushed to the Portal right after, same pattern as
 * setSubmissionGrade. */
export function setSubmissionPortfolio(input: SetHomeworkSubmissionPortfolioInput): void {
  const db = getDb()
  const now = nowIso()
  db.update(homeworkSubmissions)
    .set({ portfolio: input.portfolio, updatedAt: now })
    .where(
      and(
        eq(homeworkSubmissions.homeworkAssignmentId, input.homeworkAssignmentId),
        eq(homeworkSubmissions.studentId, input.studentId)
      )
    )
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
    gradedAt: null,
    portfolio: false
  }
  db.insert(homeworkSubmissions).values(row).run()
  return row
}
