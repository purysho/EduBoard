const test = require('node:test')
const assert = require('node:assert/strict')
const { deadlineFor, submissionTiming } = require('../services/deadlines')
// Same cases as the desktop's TypeScript copy, so the two can't drift apart.
const cases = require('../../src/shared/__tests__/deadlineCases.json')

for (const c of cases.deadlines) {
  test(`deadline: ${c.dueDate} in ${c.timeZone}`, () => {
    assert.equal(deadlineFor(c.dueDate, c.timeZone)?.toISOString() ?? null, c.deadline)
  })
}

for (const c of cases.timing) {
  test(`timing: ${c.name}`, () => {
    assert.equal(submissionTiming({ ...c, now: new Date(c.now) }), c.expected)
  })
}
