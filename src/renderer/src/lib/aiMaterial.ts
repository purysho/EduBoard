import type { LessonResource } from '@shared/types'

/** Whether a resource has an AI draft students can't see yet because it isn't checked. */
export function hasUncheckedAiMaterial(resource: LessonResource): boolean {
  return (
    (!!resource.studyGuide && !resource.aiApproved?.studyGuide) ||
    (!!resource.flashcards && !resource.aiApproved?.flashcards) ||
    (!!resource.practiceQuiz && !resource.aiApproved?.practiceQuiz)
  )
}
