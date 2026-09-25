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
      `Asked the AI about this assignment ${s.aiHelpCount === 1 ? 'once' : `${s.aiHelpCount} times`}`
    )
  }
  if (s.aiOverlap != null && s.aiOverlap >= OVERLAP_FLAG_RATIO) {
    reasons.push(
      `About ${Math.round(s.aiOverlap * 100)}% of the typed answer matches AI answers they were given`
    )
  }
  if (s.aiDeclared) reasons.push('Said they used AI (this can include tools outside the Portal)')
  return reasons
}

/** One Study Helper exchange, as the teacher sees it. */
export interface PortalAiInteraction {
  id: string
  homeworkId: string | null
  question: string
  reply: string
  createdAt: string
}
