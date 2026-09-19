import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { rubricLevels, rubricScores } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { upsertScore } from './scores'
import type { RubricScore } from '@shared/types'
import type { SaveRubricScoresInput } from '@shared/inputs'

export type { SaveRubricScoresInput }

export function listRubricScores(assessmentId: string, studentId: string): RubricScore[] {
  return getDb()
    .select()
    .from(rubricScores)
    .where(and(eq(rubricScores.assessmentId, assessmentId), eq(rubricScores.studentId, studentId)))
    .all() as RubricScore[]
}

/** Saves one student's full set of criterion -> level choices for a rubric-graded
 * assessment, then computes the total points earned (sum of the chosen levels'
 * points) and writes it through the normal scores.upsertScore path — so it flows
 * into the class's existing points-based grade calculation with no changes there,
 * and picks up score-history auditing for free. */
export function saveRubricScores(input: SaveRubricScoresInput): { pointsEarned: number } {
  const db = getDb()
  const now = nowIso()

  db.transaction(() => {
    db.delete(rubricScores)
      .where(
        and(
          eq(rubricScores.assessmentId, input.assessmentId),
          eq(rubricScores.studentId, input.studentId)
        )
      )
      .run()

    for (const selection of input.selections) {
      db.insert(rubricScores)
        .values({
          id: newId(),
          assessmentId: input.assessmentId,
          studentId: input.studentId,
          criterionId: selection.criterionId,
          levelId: selection.levelId,
          updatedAt: now
        })
        .run()
    }
  })

  const levelIds = input.selections.map((s) => s.levelId)
  const levels = levelIds.length
    ? (db.select().from(rubricLevels).where(inArray(rubricLevels.id, levelIds)).all() as {
        id: string
        points: number
      }[])
    : []
  const pointsEarned = levels.reduce((sum, level) => sum + level.points, 0)

  // excused is intentionally omitted: upsertScore falls back to the existing score's
  // excused flag when it's not passed, so re-grading a rubric assessment doesn't
  // silently clear an excused mark the teacher set some other way. comment is passed
  // through as given (including explicit null to clear it); omitting it here too would
  // make it impossible to ever clear a comment from this path.
  upsertScore({
    assessmentId: input.assessmentId,
    studentId: input.studentId,
    pointsEarned,
    ...(input.comment !== undefined ? { comment: input.comment } : {})
  })

  return { pointsEarned }
}
