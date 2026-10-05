// A class's rules for the Study Helper on the Portal: which language it replies in, the
// vocabulary level, and any rules of the teacher's own ("never write their speaking
// script for them"). Sent with each publish; on the Portal they go into the Study
// Helper's instructions for the class's students and win over each student's own
// preferences (portal/services/helperRules.js, which keeps the same shape and limits).

export const HELPER_REPLY_LANGUAGES = ['', 'english', 'english-gloss', 'own'] as const
export type HelperReplyLanguage = (typeof HELPER_REPLY_LANGUAGES)[number]

export interface StudyHelperRules {
  /** '' leaves the language to the student. */
  replyLanguage: HelperReplyLanguage
  /** e.g. "A2: short sentences, common words". */
  vocabulary: string
  /** Anything else, in the teacher's words. */
  rules: string
}

export const HELPER_RULE_LIMITS = { vocabulary: 200, rules: 500 } as const

export const EMPTY_STUDY_HELPER_RULES: StudyHelperRules = {
  replyLanguage: '',
  vocabulary: '',
  rules: ''
}

const clean = (value: unknown, max: number): string =>
  (typeof value === 'string' ? value : '')
    .replace(/[^\P{Cc}\n]/gu, '')
    .trim()
    .slice(0, max)

/** Rules from anywhere (the renderer, a stored row): known values only, text trimmed and
 * capped, control characters removed. */
export function cleanStudyHelperRules(value: unknown): StudyHelperRules {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    replyLanguage: HELPER_REPLY_LANGUAGES.includes(raw.replyLanguage as HelperReplyLanguage)
      ? (raw.replyLanguage as HelperReplyLanguage)
      : '',
    vocabulary: clean(raw.vocabulary, HELPER_RULE_LIMITS.vocabulary),
    rules: clean(raw.rules, HELPER_RULE_LIMITS.rules)
  }
}

export function isEmptyStudyHelperRules(rules: StudyHelperRules): boolean {
  return !rules.replyLanguage && !rules.vocabulary && !rules.rules
}
