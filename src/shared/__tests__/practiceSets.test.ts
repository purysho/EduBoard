import { describe, expect, it } from 'vitest'
import { validateFlashcards, validatePracticeQuiz } from '../practiceSets'
import cases from './practiceSetCases.json'

describe('validateFlashcards', () => {
  for (const c of cases.flashcards) {
    it(c.name, () => expect(validateFlashcards(c.value).ok).toBe(c.ok))
  }
})

describe('validatePracticeQuiz', () => {
  for (const c of cases.quiz) {
    it(c.name, () => expect(validatePracticeQuiz(c.value).ok).toBe(c.ok))
  }
})
