import { and, asc, eq, gte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { lessonPlans } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { LessonPlan } from '@shared/types'
import type { CreateLessonPlanInput, UpdateLessonPlanInput } from '@shared/inputs'

export type { CreateLessonPlanInput, UpdateLessonPlanInput }

export function listLessonPlansByClass(classId: string): LessonPlan[] {
  return getDb()
    .select()
    .from(lessonPlans)
    .where(eq(lessonPlans.classId, classId))
    .orderBy(asc(lessonPlans.date))
    .all() as LessonPlan[]
}

export function listUpcomingLessonPlans(fromDate: string, limit = 5): LessonPlan[] {
  return getDb()
    .select()
    .from(lessonPlans)
    .where(and(gte(lessonPlans.date, fromDate), eq(lessonPlans.status, 'planned')))
    .orderBy(asc(lessonPlans.date))
    .limit(limit)
    .all() as LessonPlan[]
}

export function getLessonPlan(id: string): LessonPlan | undefined {
  return getDb().select().from(lessonPlans).where(eq(lessonPlans.id, id)).get() as
    LessonPlan | undefined
}

export function createLessonPlan(input: CreateLessonPlanInput): LessonPlan {
  const now = nowIso()
  const row: LessonPlan = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: 'planned',
    ...input
  }
  getDb().insert(lessonPlans).values(row).run()
  return row
}

export function updateLessonPlan(id: string, patch: UpdateLessonPlanInput): LessonPlan {
  getDb()
    .update(lessonPlans)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(lessonPlans.id, id))
    .run()
  const updated = getLessonPlan(id)
  if (!updated) throw new Error(`Lesson plan ${id} not found after update`)
  return updated
}

export function deleteLessonPlan(id: string): void {
  getDb().delete(lessonPlans).where(eq(lessonPlans.id, id)).run()
}
