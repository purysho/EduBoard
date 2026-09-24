import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { assessments, attendanceRecords, enrollments, scores, students } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { recordAudit } from './auditLog'
import type { Enrollment, Student } from '@shared/types'
import type { CreateEnrollmentInput } from '@shared/inputs'

export type { CreateEnrollmentInput }

export function listEnrollmentsByClass(classId: string): Enrollment[] {
  return getDb()
    .select()
    .from(enrollments)
    .where(eq(enrollments.classId, classId))
    .all() as Enrollment[]
}

export function listEnrollmentsByStudent(studentId: string): Enrollment[] {
  return getDb()
    .select()
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId))
    .all() as Enrollment[]
}

export function getRosterForClass(classId: string): { student: Student; enrollment: Enrollment }[] {
  const rows = getDb()
    .select({ student: students, enrollment: enrollments })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(eq(enrollments.classId, classId))
    .all()
  return rows as { student: Student; enrollment: Enrollment }[]
}

export function enrollStudent(input: CreateEnrollmentInput): Enrollment {
  const row: Enrollment = {
    id: newId(),
    createdAt: nowIso(),
    status: 'active',
    ...input
  }
  getDb().insert(enrollments).values(row).run()
  recordAudit({
    entityType: 'enrollment',
    entityId: row.id,
    action: 'create',
    summary: 'Enrolled in class',
    studentId: row.studentId,
    classId: row.classId
  })
  return row
}

export function updateEnrollmentStatus(id: string, status: Enrollment['status']): void {
  const existing = getDb().select().from(enrollments).where(eq(enrollments.id, id)).get() as
    Enrollment | undefined
  getDb().update(enrollments).set({ status }).where(eq(enrollments.id, id)).run()
  if (existing) {
    recordAudit({
      entityType: 'enrollment',
      entityId: id,
      action: 'update',
      summary: `Enrollment status changed to "${status}"`,
      studentId: existing.studentId,
      classId: existing.classId
    })
  }
}

/** Hard removal: also clears this student's scores and attendance for this class so no
 * orphaned rows are left behind (unlike updateEnrollmentStatus('dropped'), which is the
 * usual "no longer taking this class but keep their record" action). */
export function unenrollStudent(studentId: string, classId: string): void {
  const db = getDb()
  db.transaction(() => {
    const classAssessmentIds = db
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.classId, classId))
      .all()
      .map((a) => a.id)

    if (classAssessmentIds.length > 0) {
      db.delete(scores)
        .where(
          and(eq(scores.studentId, studentId), inArray(scores.assessmentId, classAssessmentIds))
        )
        .run()
    }

    db.delete(attendanceRecords)
      .where(
        and(eq(attendanceRecords.classId, classId), eq(attendanceRecords.studentId, studentId))
      )
      .run()

    db.delete(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId)))
      .run()
  })
  recordAudit({
    entityType: 'enrollment',
    entityId: `${studentId}:${classId}`,
    action: 'delete',
    summary: 'Unenrolled from class (scores and attendance for this class cleared)',
    studentId,
    classId
  })
}
