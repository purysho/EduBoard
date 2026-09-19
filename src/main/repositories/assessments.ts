import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { assessments } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { Assessment } from '@shared/types'
import type { CreateAssessmentInput, UpdateAssessmentInput } from '@shared/inputs'

export type { CreateAssessmentInput, UpdateAssessmentInput }

export function listAssessmentsByClass(classId: string): Assessment[] {
  return getDb()
    .select()
    .from(assessments)
    .where(eq(assessments.classId, classId))
    .orderBy(asc(assessments.sortOrder), asc(assessments.assessmentDate))
    .all() as Assessment[]
}

export function getAssessment(id: string): Assessment | undefined {
  return getDb().select().from(assessments).where(eq(assessments.id, id)).get() as
    Assessment | undefined
}

export function createAssessment(input: CreateAssessmentInput): Assessment {
  const now = nowIso()
  const row: Assessment = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    isFinal: false,
    sortOrder: 0,
    ...input
  }
  getDb().insert(assessments).values(row).run()
  return row
}

export function updateAssessment(id: string, patch: UpdateAssessmentInput): Assessment {
  getDb()
    .update(assessments)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(assessments.id, id))
    .run()
  const updated = getAssessment(id)
  if (!updated) throw new Error(`Assessment ${id} not found after update`)
  return updated
}

export function deleteAssessment(id: string): void {
  getDb().delete(assessments).where(eq(assessments.id, id)).run()
}
