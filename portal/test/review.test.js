const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')
const { nextState, interleave, studentToday } = require('../services/review')

const cards = Array.from({ length: 12 }, (_, i) => ({ front: `Term ${i}`, back: `Meaning ${i}` }))
const questions = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i}?`,
  options: ['A', 'B', 'C', 'D'],
  answerIndex: 1,
  explanation: 'Because B.'
}))

test('the Leitner boxes: right moves up and waits longer, wrong goes back to box 1', () => {
  assert.deepEqual(nextState(undefined, true, '2026-10-01'), { box: 2, dueOn: '2026-10-03' })
  assert.deepEqual(nextState(2, true, '2026-10-01'), { box: 3, dueOn: '2026-10-05' })
  assert.deepEqual(nextState(4, true, '2026-10-01'), { box: 5, dueOn: '2026-10-17' })
  assert.deepEqual(nextState(5, true, '2026-10-01'), { box: 5, dueOn: '2026-10-17' })
  assert.deepEqual(nextState(4, false, '2026-10-01'), { box: 1, dueOn: '2026-10-02' })
})

test('a day mixes materials, and the student’s own date counts only within a day', () => {
  const mixed = interleave([
    { materialId: 'a', n: 1 },
    { materialId: 'a', n: 2 },
    { materialId: 'b', n: 3 }
  ])
  assert.deepEqual(
    mixed.map((i) => i.n),
    [1, 3, 2]
  )
  const now = new Date('2026-10-01T12:00:00Z')
  assert.equal(studentToday('2026-10-02', now), '2026-10-02')
  assert.equal(studentToday('2026-12-25', now), '2026-10-01')
  assert.equal(studentToday('nonsense', now), '2026-10-01')
})

test('students review, answers move cards between boxes, and the teacher sees what’s missed', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, {
    payload: classPayload({
      extra: {
        materials: [
          { id: 'm1', classId: 'c1', title: 'Unit 1 words', flashcards: cards },
          { id: 'm2', classId: 'c1', title: 'Unit 1 check', practiceQuiz: questions }
        ]
      }
    })
  })
  const today = new Date().toISOString().slice(0, 10)
  const get = async () =>
    (await portal.call('GET', `/api/me/review?studentId=s1&today=${today}`, { cookie })).json

  const first = await get()
  assert.equal(first.total, 17)
  assert.equal(first.items.length, 10) // new cards join ten a day
  assert.equal(first.newCount, 17)
  // Cards and questions alternate while both are left.
  assert.deepEqual(
    first.items.slice(0, 4).map((i) => i.kind),
    ['card', 'question', 'card', 'question']
  )

  const answer = (item, correct) =>
    portal.call('POST', '/api/me/review/answer', {
      cookie,
      body: {
        studentId: 's1',
        materialId: item.materialId,
        kind: item.kind,
        key: item.key,
        correct,
        today
      }
    })
  const [a, b] = first.items
  assert.equal((await answer(a, true)).json.box, 2)
  const missed = await answer(b, false)
  assert.equal(missed.json.box, 1)
  assert.notEqual(missed.json.dueOn, today) // tomorrow, not again today

  const after = await get()
  assert.equal(after.newCount, 15)
  assert.deepEqual(after.boxes, [1, 1, 0, 0, 0])
  assert.ok(!after.items.some((i) => i.key === a.key || i.key === b.key))

  // Not their card, or not their student.
  assert.equal((await answer({ ...a, key: 'nope' }, true)).status, 404)
  const other = await portal.call('GET', `/api/me/review?studentId=someone-else`, { cookie })
  assert.equal(other.status, 403)

  const stats = (await portal.sync('/review-stats')).json
  const quiz = stats.find((s) => s.materialId === 'm2')
  assert.equal(quiz.students, 1)
  assert.deepEqual(quiz.items[0], {
    kind: 'question',
    text: b.question.question,
    students: 1,
    right: 0,
    wrong: 1,
    learned: 0
  })
})
