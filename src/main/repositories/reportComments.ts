import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { reportComments } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { ReportComment } from '@shared/types'

export function listReportComments(classId: string): ReportComment[] {
  return getDb()
    .select()
    .from(reportComments)
    .where(eq(reportComments.classId, classId))
    .all() as ReportComment[]
}

export function getReportComment(classId: string, studentId: string): ReportComment | undefined {
  return getDb()
    .select()
    .from(reportComments)
    .where(and(eq(reportComments.classId, classId), eq(reportComments.studentId, studentId)))
    .get() as ReportComment | undefined
}

/** Saves a student's comment for the class; an empty comment removes it. */
export function setReportComment(classId: string, studentId: string, text: string): void {
  const db = getDb()
  const value = text.trim().slice(0, 4000)
  const existing = getReportComment(classId, studentId)
  if (!value) {
    if (existing) db.delete(reportComments).where(eq(reportComments.id, existing.id)).run()
    return
  }
  if (existing) {
    db.update(reportComments)
      .set({ text: value, updatedAt: nowIso() })
      .where(eq(reportComments.id, existing.id))
      .run()
  } else {
    db.insert(reportComments)
      .values({ id: newId(), classId, studentId, text: value, updatedAt: nowIso() })
      .run()
  }
}
