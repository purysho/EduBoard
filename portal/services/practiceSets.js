// Plain-JS copy of src/shared/practiceSets.ts validation (the Portal has no build step).
// Every flashcard/quiz set arriving in a publish is re-checked here: the Portal renders
// these to students, so it never trusts the payload's shape. Tested against the same
// fixtures as the desktop copy; change them together.

const PRACTICE_LIMITS = {
  flashcards: { min: 4, max: 30, frontChars: 300, backChars: 600 },
  quiz: { min: 3, max: 15, questionChars: 500, optionChars: 250, explanationChars: 700, minOptions: 2, maxOptions: 5 }
}

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max

function validateFlashcards(value) {
  const L = PRACTICE_LIMITS.flashcards
  if (!Array.isArray(value)) return { ok: false, reason: 'not a list' }
  if (value.length < L.min || value.length > L.max) {
    return { ok: false, reason: `needs ${L.min}-${L.max} cards, got ${value.length}` }
  }
  const cards = []
  for (const [i, card] of value.entries()) {
    if (!card || !isText(card.front, L.frontChars) || !isText(card.back, L.backChars)) {
      return { ok: false, reason: `card ${i + 1} is malformed or too long` }
    }
    cards.push({ front: card.front.trim(), back: card.back.trim() })
  }
  return { ok: true, value: cards }
}

function validatePracticeQuiz(value) {
  const L = PRACTICE_LIMITS.quiz
  if (!Array.isArray(value)) return { ok: false, reason: 'not a list' }
  if (value.length < L.min || value.length > L.max) {
    return { ok: false, reason: `needs ${L.min}-${L.max} questions, got ${value.length}` }
  }
  const questions = []
  for (const [i, item] of value.entries()) {
    const options = item?.options
    if (
      !item ||
      !isText(item.question, L.questionChars) ||
      !isText(item.explanation, L.explanationChars) ||
      !Array.isArray(options) ||
      options.length < L.minOptions ||
      options.length > L.maxOptions ||
      !options.every((o) => isText(o, L.optionChars)) ||
      new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length ||
      !Number.isInteger(item.answerIndex) ||
      item.answerIndex < 0 ||
      item.answerIndex >= options.length
    ) {
      return { ok: false, reason: `question ${i + 1} is malformed` }
    }
    questions.push({
      question: item.question.trim(),
      options: options.map((o) => o.trim()),
      answerIndex: item.answerIndex,
      explanation: item.explanation.trim()
    })
  }
  return { ok: true, value: questions }
}

module.exports = { validateFlashcards, validatePracticeQuiz, PRACTICE_LIMITS }
