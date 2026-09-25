// Flashcards and practice quizzes generated from a shared resource (NotebookLM-style
// self-study). They're drafted by AI on the teacher's desktop, saved with the resource
// and published with it, so students use them with no per-student AI cost.
//
// These validators decide what counts as a usable set. The desktop runs them on the
// model's reply before saving anything, and portal/services/practiceSets.js re-checks
// every set it receives on publish (it never trusts the payload's shape). Keep the two
// in step; both are tested against the same fixtures.

export interface Flashcard {
  front: string
  back: string
}

export interface PracticeQuestion {
  question: string
  options: string[]
  /** Index into `options`. Self-study only: students see answers after checking. */
  answerIndex: number
  explanation: string
}

export const PRACTICE_LIMITS = {
  flashcards: { min: 4, max: 30, frontChars: 300, backChars: 600 },
  quiz: {
    min: 3,
    max: 15,
    questionChars: 500,
    optionChars: 250,
    explanationChars: 700,
    minOptions: 2,
    maxOptions: 5
  }
} as const

const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max

/** Returns the cleaned cards, or a reason the set is unusable. */
export function validateFlashcards(
  value: unknown
): { ok: true; value: Flashcard[] } | { ok: false; reason: string } {
  const L = PRACTICE_LIMITS.flashcards
  if (!Array.isArray(value)) return { ok: false, reason: 'not a list' }
  if (value.length < L.min || value.length > L.max) {
    return { ok: false, reason: `needs ${L.min}-${L.max} cards, got ${value.length}` }
  }
  const cards: Flashcard[] = []
  for (const [i, c] of value.entries()) {
    const card = c as Record<string, unknown> | null
    if (!card || !isText(card.front, L.frontChars) || !isText(card.back, L.backChars)) {
      return { ok: false, reason: `card ${i + 1} is malformed or too long` }
    }
    cards.push({ front: card.front.trim(), back: card.back.trim() })
  }
  return { ok: true, value: cards }
}

/** Returns the cleaned questions, or a reason the set is unusable. */
export function validatePracticeQuiz(
  value: unknown
): { ok: true; value: PracticeQuestion[] } | { ok: false; reason: string } {
  const L = PRACTICE_LIMITS.quiz
  if (!Array.isArray(value)) return { ok: false, reason: 'not a list' }
  if (value.length < L.min || value.length > L.max) {
    return { ok: false, reason: `needs ${L.min}-${L.max} questions, got ${value.length}` }
  }
  const questions: PracticeQuestion[] = []
  for (const [i, q] of value.entries()) {
    const item = q as Record<string, unknown> | null
    const options = item?.options
    if (
      !item ||
      !isText(item.question, L.questionChars) ||
      !isText(item.explanation, L.explanationChars) ||
      !Array.isArray(options) ||
      options.length < L.minOptions ||
      options.length > L.maxOptions ||
      !options.every((o) => isText(o, L.optionChars)) ||
      new Set(options.map((o: string) => o.trim().toLowerCase())).size !== options.length ||
      !Number.isInteger(item.answerIndex) ||
      (item.answerIndex as number) < 0 ||
      (item.answerIndex as number) >= options.length
    ) {
      return { ok: false, reason: `question ${i + 1} is malformed` }
    }
    questions.push({
      question: item.question.trim(),
      options: (options as string[]).map((o) => o.trim()),
      answerIndex: item.answerIndex as number,
      explanation: item.explanation.trim()
    })
  }
  return { ok: true, value: questions }
}
