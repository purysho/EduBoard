import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { lessonEvidence, lessonPlans } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { LessonEvidence, LessonEvidenceValue } from '@shared/types'
import type { UpsertLessonEvidenceInput } from '@shared/inputs'

export type { UpsertLessonEvidenceInput }

const VALUES = new Set<LessonEvidenceValue>(['✓', '1', '2', '3', '4', '5', 'M', 'N'])

export function listLessonEvidenceByClass(classId: string): LessonEvidence[] {
  const rows = getDb()
    .select({ evidence: lessonEvidence })
    .from(lessonEvidence)
    .innerJoin(lessonPlans, eq(lessonEvidence.lessonPlanId, lessonPlans.id))
    .where(eq(lessonPlans.classId, classId))
    .all() as { evidence: LessonEvidence }[]
  return rows.map((row) => row.evidence)
}

export function upsertLessonEvidence(input: UpsertLessonEvidenceInput): LessonEvidence | null {
  const db = getDb()
  const existing = db
    .select()
    .from(lessonEvidence)
    .where(
      and(
        eq(lessonEvidence.lessonPlanId, input.lessonPlanId),
        eq(lessonEvidence.studentId, input.studentId)
      )
    )
    .get() as LessonEvidence | undefined

  if (input.value === null) {
    if (existing) db.delete(lessonEvidence).where(eq(lessonEvidence.id, existing.id)).run()
    return null
  }
  if (!VALUES.has(input.value)) return existing ?? null

  const now = nowIso()
  if (existing) {
    db.update(lessonEvidence)
      .set({ value: input.value, updatedAt: now })
      .where(eq(lessonEvidence.id, existing.id))
      .run()
    return { ...existing, value: input.value, updatedAt: now }
  }

  const row: LessonEvidence = {
    id: newId(),
    lessonPlanId: input.lessonPlanId,
    studentId: input.studentId,
    value: input.value,
    updatedAt: now
  }
  db.insert(lessonEvidence).values(row).run()
  return row
}
