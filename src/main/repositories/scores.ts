import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { assessments, scores } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { Score } from '@shared/types'
import type { UpsertScoreInput } from '@shared/inputs'

export type { UpsertScoreInput }

export function listScoresByAssessment(assessmentId: string): Score[] {
  return getDb().select().from(scores).where(eq(scores.assessmentId, assessmentId)).all() as Score[]
}

export function listScoresByClass(classId: string): Score[] {
  const rows = getDb()
    .select({ score: scores })
    .from(scores)
    .innerJoin(assessments, eq(scores.assessmentId, assessments.id))
    .where(eq(assessments.classId, classId))
    .all() as { score: Score }[]
  return rows.map((r) => r.score)
}

export function listScoresByStudentAndClass(studentId: string, classId: string): Score[] {
  const rows = getDb()
    .select({ score: scores })
    .from(scores)
    .innerJoin(assessments, eq(scores.assessmentId, assessments.id))
    .where(and(eq(assessments.classId, classId), eq(scores.studentId, studentId)))
    .all() as { score: Score }[]
  return rows.map((r) => r.score)
}

/** Insert-or-update a single score cell (assessment x student is unique). */
export function upsertScore(input: UpsertScoreInput): Score {
  const db = getDb()
  const existing = db
    .select()
    .from(scores)
    .where(and(eq(scores.assessmentId, input.assessmentId), eq(scores.studentId, input.studentId)))
    .get() as Score | undefined

  const now = nowIso()

  if (existing) {
    const patch = {
      pointsEarned: input.pointsEarned,
      excused: input.excused ?? existing.excused,
      late: input.late ?? existing.late,
      comment: input.comment ?? existing.comment,
      updatedAt: now
    }
    db.update(scores).set(patch).where(eq(scores.id, existing.id)).run()
    return { ...existing, ...patch }
  }

  const row: Score = {
    id: newId(),
    assessmentId: input.assessmentId,
    studentId: input.studentId,
    pointsEarned: input.pointsEarned,
    excused: input.excused ?? false,
    late: input.late ?? false,
    comment: input.comment ?? null,
    updatedAt: now
  }
  db.insert(scores).values(row).run()
  return row
}

export function upsertScoresBulk(inputs: UpsertScoreInput[]): void {
  getDb().transaction(() => {
    for (const input of inputs) upsertScore(input)
  })
}
