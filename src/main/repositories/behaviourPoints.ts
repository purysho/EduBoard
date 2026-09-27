import { and, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { behaviourPoints } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { getSettings } from './settingsRepo'
import type { BehaviourPoint, BehaviourTotal } from '@shared/types'
import {
  resolvePointCategories,
  summarisePoints,
  type PointSummaryItem
} from '@shared/pointCategories'

export function addBehaviourPoint(input: {
  classId: string
  studentId: string
  points: number
  reason?: string | null
  /** A point category id; one the school doesn't have is stored as none. */
  category?: string | null
}): BehaviourPoint {
  const points = Math.max(-5, Math.min(5, Math.trunc(input.points))) || 1
  const category =
    resolvePointCategories(getSettings().pointCategories).find((c) => c.id === input.category) ??
    null
  const row: BehaviourPoint = {
    id: newId(),
    classId: input.classId,
    studentId: input.studentId,
    points,
    // The category's name at the time, so a point still reads right in a backup or export.
    reason: input.reason?.trim().slice(0, 80) || category?.name || null,
    category: category?.id ?? null,
    createdAt: nowIso()
  }
  getDb().insert(behaviourPoints).values(row).run()
  return row
}

/** Each student's points in the class since `weekStartIso`, and in total. */
export function behaviourTotals(classId: string, weekStartIso: string): BehaviourTotal[] {
  const rows = getDb()
    .select()
    .from(behaviourPoints)
    .where(eq(behaviourPoints.classId, classId))
    .all() as BehaviourPoint[]
  const byStudent = new Map<string, BehaviourTotal>()
  for (const r of rows) {
    const t = byStudent.get(r.studentId) ?? { studentId: r.studentId, week: 0, total: 0 }
    t.total += r.points
    if (r.createdAt >= weekStartIso) t.week += r.points
    byStudent.set(r.studentId, t)
  }
  return [...byStudent.values()]
}

/** Takes back the class's most recent point (a mis-tap). Returns it, or null. */
export function undoLastBehaviourPoint(classId: string): BehaviourPoint | null {
  const db = getDb()
  const last = db
    .select()
    .from(behaviourPoints)
    .where(eq(behaviourPoints.classId, classId))
    .orderBy(desc(behaviourPoints.createdAt))
    .limit(1)
    .get() as BehaviourPoint | undefined
  if (!last) return null
  db.delete(behaviourPoints)
    .where(and(eq(behaviourPoints.id, last.id), eq(behaviourPoints.classId, classId)))
    .run()
  return last
}

export function listBehaviourPointsForStudent(
  classId: string,
  studentId: string
): BehaviourPoint[] {
  return getDb()
    .select()
    .from(behaviourPoints)
    .where(and(eq(behaviourPoints.classId, classId), eq(behaviourPoints.studentId, studentId)))
    .orderBy(desc(behaviourPoints.createdAt))
    .all() as BehaviourPoint[]
}

/** Each student's points in the class by category (since `sinceIso`, if given): for
 * report cards (the whole class, i.e. the term) and the weekly digest (this week). */
export function pointSummaries(
  classId: string,
  sinceIso?: string
): Map<string, PointSummaryItem[]> {
  const rows = getDb()
    .select()
    .from(behaviourPoints)
    .where(
      sinceIso
        ? and(eq(behaviourPoints.classId, classId), gte(behaviourPoints.createdAt, sinceIso))
        : eq(behaviourPoints.classId, classId)
    )
    .all() as BehaviourPoint[]
  const categories = resolvePointCategories(getSettings().pointCategories)
  const byStudent = new Map<string, BehaviourPoint[]>()
  for (const r of rows) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r])
  return new Map(
    [...byStudent].map(([studentId, points]) => [studentId, summarisePoints(points, categories)])
  )
}
