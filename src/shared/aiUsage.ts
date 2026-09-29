import { tr, trn } from './i18n'
// How a student's submission involved the Portal's AI, as recorded when it was turned in
// (portal/services/aiUsage.js decides; this mirrors its rule so the desktop can explain
// the badge). Keep OVERLAP_FLAG_RATIO equal to the Portal's.

export const OVERLAP_FLAG_RATIO = 0.2

export interface SubmissionAiFacts {
  aiDeclared: boolean
  aiHelpCount: number
  /** Share (0-1) of the typed answer found in AI answers the student was given. */
  aiOverlap: number | null
}

/** Plain-language reasons a submission shows "Used AI"; empty when it doesn't. */
export function aiUsageReasons(s: SubmissionAiFacts): string[] {
  const reasons: string[] = []
  if (s.aiHelpCount > 0) {
    reasons.push(
      trn(
        'Asked the AI about this assignment once',
        'Asked the AI about this assignment {n} times',
        s.aiHelpCount
      )
    )
  }
  if (s.aiOverlap != null && s.aiOverlap >= OVERLAP_FLAG_RATIO) {
    reasons.push(
      tr('About {percent}% of the typed answer matches AI answers they were given', {
        percent: Math.round(s.aiOverlap * 100)
      })
    )
  }
  if (s.aiDeclared)
    reasons.push(tr('Said they used AI (this can include tools outside the Portal)'))
  return reasons
}

/** One Study Helper exchange, as the teacher sees it. */
/** How students are doing with spaced review of one material's flashcards or practice
 * questions (portal/services/review.js), most-missed first. */
export interface PortalReviewStats {
  materialId: string
  title: string
  /** Students who have reviewed anything from this material. */
  students: number
  items: {
    kind: 'card' | 'question'
    text: string
    students: number
    right: number
    wrong: number
    /** Students who have it in box 4 or 5 (answered right several times, days apart). */
    learned: number
  }[]
}

export interface PortalAiInteraction {
  id: string
  homeworkId: string | null
  question: string
  reply: string
  createdAt: string
}
