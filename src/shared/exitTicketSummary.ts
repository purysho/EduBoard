// What a class's exit-ticket answers say about today's lesson: for each choice question,
// how many chose each option, and, where the teacher marked the options that show
// understanding, whether enough of the class got there. Fewer than 70% is the usual sign
// to re-teach before moving on (the same bar mastery-learning approaches use).
import { tr } from './i18n'
import type { ExitTicketQuestion, ExitTicketResponse } from './types'

export const RETEACH_BELOW = 0.7
/** Below this many answers a percentage says little, so no suggestion is made. */
export const MIN_ANSWERS = 3

export interface ExitTicketQuestionSummary {
  id: string
  prompt: string
  type: ExitTicketQuestion['type']
  answered: number
  /** Choice questions: each option and how many chose it. */
  options: { label: string; count: number; good: boolean }[]
  /** Share who chose an option marked as showing understanding, or null if none marked. */
  understood: number | null
  reteach: boolean
  /** Short-answer questions: the answers, for reading. */
  texts: string[]
}

export function summarizeExitTicket(
  questions: ExitTicketQuestion[],
  responses: ExitTicketResponse[]
): ExitTicketQuestionSummary[] {
  return questions.map((q) => {
    const answers = responses
      .map((r) => r.answers[q.id])
      .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
    const good = new Set(q.goodOptions ?? [])
    const options =
      q.type === 'choice'
        ? (q.options ?? []).map((label, i) => ({
            label,
            count: answers.filter((a) => a === label).length,
            good: good.has(i)
          }))
        : []
    const marked = q.type === 'choice' && options.some((o) => o.good)
    const understood =
      marked && answers.length
        ? options.filter((o) => o.good).reduce((n, o) => n + o.count, 0) / answers.length
        : null
    return {
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      answered: answers.length,
      options,
      understood,
      reteach: understood !== null && answers.length >= MIN_ANSWERS && understood < RETEACH_BELOW,
      texts: q.type === 'text' ? answers : []
    }
  })
}

/** A ready-made question for how well the lesson landed. The first two options count as
 * understanding. */
export function confidenceQuestion(id: string): ExitTicketQuestion {
  return {
    id,
    prompt: tr('How well do you understand today’s lesson?'),
    type: 'choice',
    options: [
      tr('I could explain it to a classmate'),
      tr('I mostly understand it'),
      tr('I’m not sure yet'),
      tr('I’m lost')
    ],
    goodOptions: [0, 1]
  }
}
