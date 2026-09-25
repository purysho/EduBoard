import {
  getHomeworkAssignment,
  listSubmissionsForAssignment
} from '../repositories/homeworkAssignments'
import { getRubric } from '../repositories/rubrics'
import { askAi } from './aiService'
import { canExtractText, extractFileText } from './notebookService'
import { downloadSubmissionFile } from './portalSyncService'
import { buildFeedbackPrompt, parseFeedbackDraft } from './feedbackPrompt'
import type { FeedbackDraft } from '@shared/types'

/** Drafts feedback for one student's submission. Reads the assignment, its rubric, the
 * written answer and (for PDF/text attachments) the attached file, then asks the
 * configured AI provider. Saves nothing. See feedbackPrompt.ts for the rules. */
export async function draftSubmissionFeedback(
  homeworkAssignmentId: string,
  studentId: string
): Promise<FeedbackDraft> {
  const assignment = getHomeworkAssignment(homeworkAssignmentId)
  if (!assignment) throw new Error('Assignment not found')
  const submission = listSubmissionsForAssignment(homeworkAssignmentId, assignment.classId).find(
    (s) => s.studentId === studentId
  )
  if (!submission || submission.status === 'not_started') {
    throw new Error('This student has not turned anything in yet.')
  }

  let attachment: { name: string; text: string | null } | null = null
  if (submission.fileName) {
    let text: string | null = null
    if (canExtractText(submission.fileName)) {
      try {
        const localPath = await downloadSubmissionFile(
          homeworkAssignmentId,
          studentId,
          submission.fileName
        )
        text = await extractFileText(localPath)
      } catch {
        // Unreadable here (network, scanned PDF): the prompt tells the model to judge the
        // written answer only and flag that it couldn't read the file.
        text = null
      }
    }
    attachment = { name: submission.fileName, text }
  }

  const rubric = assignment.rubricId ? getRubric(assignment.rubricId) : undefined
  const { system, user } = buildFeedbackPrompt({
    assignmentTitle: assignment.title,
    assignmentDescription: assignment.description,
    rubric: rubric
      ? {
          name: rubric.name,
          maxPoints: rubric.maxPoints,
          criteria: rubric.criteria.map((c) => ({
            name: c.name,
            description: c.description,
            levels: c.levels.map((l) => ({ label: l.label, points: l.points }))
          }))
        }
      : null,
    answerText: submission.textAnswer,
    attachment
  })

  const started = Date.now()
  const reply = await askAi(system, user, 1024)
  console.info(
    `[ai] feedback draft for ${homeworkAssignmentId}/${studentId}: ${Date.now() - started}ms, prompt v1`
  )
  return parseFeedbackDraft(reply)
}
