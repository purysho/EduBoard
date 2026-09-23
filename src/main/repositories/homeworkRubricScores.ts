import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { homeworkRubricScores, rubricLevels } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { getRubric } from './rubrics'
import { setSubmissionGrade } from './homeworkAssignments'
import type { HomeworkRubricScore } from '@shared/types'
import type { SaveHomeworkRubricScoresInput } from '@shared/inputs'

export type { SaveHomeworkRubricScoresInput }

export function listHomeworkRubricScores(
  homeworkAssignmentId: string,
  studentId: string
): HomeworkRubricScore[] {
  return getDb()
    .select()
    .from(homeworkRubricScores)
    .where(
      and(
        eq(homeworkRubricScores.homeworkAssignmentId, homeworkAssignmentId),
        eq(homeworkRubricScores.studentId, studentId)
      )
    )
    .all() as HomeworkRubricScore[]
}

/** Saves one student's criterion -> level choices for a rubric-linked homework
 * assignment, then writes the total through to the submission's ordinary grade/feedback
 * text fields (via setSubmissionGrade) as "earned/max" — so the Portal, Portfolio, and
 * everywhere else that already reads a submission's grade need no changes to show it. */
export function saveHomeworkRubricScores(
  input: SaveHomeworkRubricScoresInput,
  rubricId: string
): { pointsEarned: number; maxPoints: number } {
  const db = getDb()
  const now = nowIso()

  db.transaction(() => {
    db.delete(homeworkRubricScores)
      .where(
        and(
          eq(homeworkRubricScores.homeworkAssignmentId, input.homeworkAssignmentId),
          eq(homeworkRubricScores.studentId, input.studentId)
        )
      )
      .run()

    for (const selection of input.selections) {
      db.insert(homeworkRubricScores)
        .values({
          id: newId(),
          homeworkAssignmentId: input.homeworkAssignmentId,
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
  const rubric = getRubric(rubricId)
  const maxPoints = rubric?.maxPoints ?? 0

  setSubmissionGrade({
    homeworkAssignmentId: input.homeworkAssignmentId,
    studentId: input.studentId,
    grade: `${pointsEarned}/${maxPoints}`,
    feedback: input.feedback ?? null
  })

  return { pointsEarned, maxPoints }
}
