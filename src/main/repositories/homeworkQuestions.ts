import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { homeworkQuestions } from '../db/schema'
import { newId } from '../db/util'
import type { HomeworkQuestion } from '@shared/types'
import type { DraftHomeworkQuestion } from '@shared/inputs'

export type { DraftHomeworkQuestion }

export function listHomeworkQuestions(homeworkAssignmentId: string): HomeworkQuestion[] {
  return getDb()
    .select()
    .from(homeworkQuestions)
    .where(eq(homeworkQuestions.homeworkAssignmentId, homeworkAssignmentId))
    .orderBy(homeworkQuestions.sortOrder)
    .all() as HomeworkQuestion[]
}

/** Wholesale-replaces an assignment's question set — same "the teacher's edit is the
 * full current state, not a diff" shape as resourceChunks, since a teacher editing
 * questions in the UI submits the complete list each save, not individual edits. */
export function replaceHomeworkQuestions(
  homeworkAssignmentId: string,
  questions: DraftHomeworkQuestion[]
): void {
  const db = getDb()
  db.transaction(() => {
    db.delete(homeworkQuestions)
      .where(eq(homeworkQuestions.homeworkAssignmentId, homeworkAssignmentId))
      .run()
    questions.forEach((q, i) => {
      db.insert(homeworkQuestions)
        .values({
          id: newId(),
          homeworkAssignmentId,
          type: q.type,
          prompt: q.prompt,
          options: q.type === 'multiple_choice' ? q.options : null,
          correctAnswer: q.correctAnswer,
          points: q.points,
          sortOrder: i
        })
        .run()
    })
  })
}
