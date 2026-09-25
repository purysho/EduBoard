const test = require('node:test')
const assert = require('node:assert/strict')
const { validateFlashcards, validatePracticeQuiz } = require('../services/practiceSets')
// Same fixtures as the desktop validator, so the two can't disagree about a set.
const cases = require('../../src/shared/__tests__/practiceSetCases.json')

for (const c of cases.flashcards) {
  test(`flashcards: ${c.name}`, () => assert.equal(validateFlashcards(c.value).ok, c.ok))
}
for (const c of cases.quiz) {
  test(`quiz: ${c.name}`, () => assert.equal(validatePracticeQuiz(c.value).ok, c.ok))
}
