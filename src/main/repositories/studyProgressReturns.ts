import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { studyProgressReturns } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { StudyProgressReturn, StudyProgressReturnFile } from '@shared/studyProgress'

export function listStudyProgressReturns(resourceId: string): StudyProgressReturn[] {
  return getDb()
    .select()
    .from(studyProgressReturns)
    .where(eq(studyProgressReturns.resourceId, resourceId))
    .orderBy(desc(studyProgressReturns.exportedAt), desc(studyProgressReturns.importedAt))
    .all() as StudyProgressReturn[]
}

export function importStudyProgressReturn(
  progress: StudyProgressReturnFile,
  studentId: string | null
): StudyProgressReturn {
  const existing = getDb()
    .select()
    .from(studyProgressReturns)
    .where(
      and(
        eq(studyProgressReturns.resourceId, progress.resourceId),
        eq(studyProgressReturns.studentName, progress.studentName),
        eq(studyProgressReturns.exportedAt, progress.exportedAt)
      )
    )
    .get() as StudyProgressReturn | undefined
  if (existing) return existing

  const row: StudyProgressReturn = {
    id: newId(),
    resourceId: progress.resourceId,
    studentId,
    studentName: progress.studentName,
    exportedAt: progress.exportedAt,
    importedAt: nowIso(),
    cards: progress.cards,
    quiz: progress.quiz
  }
  getDb().insert(studyProgressReturns).values(row).run()
  return row
}
