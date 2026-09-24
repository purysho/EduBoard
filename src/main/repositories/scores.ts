import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { assessments, scoreHistory, scores } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { recordAudit } from './auditLog'
import type { Score, ScoreHistoryEntry } from '@shared/types'
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
    const valueChanged =
      patch.pointsEarned !== existing.pointsEarned || patch.excused !== existing.excused
    db.transaction(() => {
      db.update(scores).set(patch).where(eq(scores.id, existing.id)).run()
      if (valueChanged) {
        db.insert(scoreHistory)
          .values({
            id: newId(),
            scoreId: existing.id,
            assessmentId: existing.assessmentId,
            studentId: existing.studentId,
            previousPoints: existing.pointsEarned,
            newPoints: patch.pointsEarned,
            previousExcused: existing.excused,
            newExcused: patch.excused,
            changedAt: now
          })
          .run()
      }
    })
    if (valueChanged) logScoreAudit(existing.assessmentId, existing.studentId, 'update')
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
  logScoreAudit(row.assessmentId, row.studentId, 'create')
  return row
}

function logScoreAudit(assessmentId: string, studentId: string, action: 'create' | 'update'): void {
  const assessment = getDb()
    .select({ name: assessments.name, classId: assessments.classId })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .get() as { name: string; classId: string } | undefined
  recordAudit({
    entityType: 'score',
    entityId: `${assessmentId}:${studentId}`,
    action,
    summary: `Grade ${action === 'create' ? 'set' : 'changed'} for "${assessment?.name ?? 'assessment'}"`,
    studentId,
    classId: assessment?.classId ?? null
  })
}

export function upsertScoresBulk(inputs: UpsertScoreInput[]): void {
  getDb().transaction(() => {
    for (const input of inputs) upsertScore(input)
  })
}

export function listScoreHistory(assessmentId: string, studentId: string): ScoreHistoryEntry[] {
  return getDb()
    .select()
    .from(scoreHistory)
    .where(and(eq(scoreHistory.assessmentId, assessmentId), eq(scoreHistory.studentId, studentId)))
    .orderBy(desc(scoreHistory.changedAt))
    .all() as ScoreHistoryEntry[]
}
