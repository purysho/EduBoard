const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')
const { learningStateText, mondayOf } = require('../services/learningState')

test('the learning state reads as short lines, and is empty when there is nothing to say', () => {
  assert.equal(
    learningStateText({ weakItems: [], missedChecks: [], weekGoal: '', reviewed: 0, learned: 0 }),
    ''
  )
  const text = learningStateText({
    weekGoal: 'Learn the Unit 2 words',
    reviewed: 12,
    learned: 3,
    weakItems: [{ text: 'exhibit', from: 'Unit 1 words', wrong: 2 }],
    missedChecks: [{ text: 'What does "survey" mean?', from: 'Week 3 check' }]
  })
  assert.match(text, /Their own goal this week: Learn the Unit 2 words/)
  assert.match(text, /12 cards practised, 3 well learned/)
  assert.match(text, /- "exhibit" \(from Unit 1 words; missed 2×\)/)
  assert.match(text, /- "What does "survey" mean\?" \(in Week 3 check\)/)
  assert.equal(mondayOf('2026-10-08'), '2026-10-05')
})

test('the Study Helper hears which cards and checks this student keeps missing', async (t) => {
  const requests = []
  const ai = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      requests.push(JSON.parse(raw))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: 'Try this one: exhibit?' } }] }))
    })
  })
  await new Promise((r) => ai.listen(0, '127.0.0.1', r))
  const portal = await startPortal()
  t.after(async () => {
    await portal.stop()
    ai.close()
  })
  // A flashcard set needs several cards; the first two are the ones this test uses.
  const cards = [
    { front: 'exhibit', back: 'something shown in a museum' },
    { front: 'survey', back: 'questions asked to many people' },
    ...Array.from({ length: 8 }, (_, i) => ({ front: `word ${i}`, back: `meaning ${i}` }))
  ]
  const { cookie } = await makeStudentAccount(portal, {
    payload: classPayload({
      extra: {
        aiProvider: 'custom',
        aiApiKey: 'unused',
        aiCustomBaseUrl: `http://127.0.0.1:${ai.address().port}`,
        aiCustomModel: 'mock',
        materials: [{ id: 'm1', classId: 'c1', title: 'Unit 1 words', flashcards: cards }],
        homeworkAssignments: [
          {
            id: 'h1',
            classId: 'c1',
            title: 'Week 3 check',
            questions: [
              { type: 'short_answer', prompt: 'What is 6 x 7?', correctAnswer: '42', points: 1 }
            ]
          }
        ]
      }
    })
  })
  const today = new Date().toISOString().slice(0, 10)
  const chat = (mode) =>
    portal.call('POST', '/api/me/ai/chat', {
      cookie,
      body: { studentId: 's1', message: 'Quiz me', mode }
    })

  // Before any practice there is nothing to personalise with.
  assert.equal((await chat('quiz')).status, 200)
  assert.doesNotMatch(JSON.stringify(requests.at(-1)), /learning_state/)

  // Miss "exhibit" twice in review, get "survey" right, and get the quick check wrong.
  const review = (
    await portal.call('GET', `/api/me/review?studentId=s1&today=${today}`, { cookie })
  ).json
  const byFront = Object.fromEntries(review.items.map((i) => [i.card.front, i]))
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
  await answer(byFront.exhibit, false)
  await answer(byFront.exhibit, false)
  await answer(byFront.survey, true)
  const me = await portal.call('GET', '/api/me', { cookie })
  const qid = me.json.students[0].classes[0].homework[0].questions[0].id
  await portal.call('POST', '/api/me/homework/h1/answers', {
    cookie,
    body: { studentId: 's1', answers: { [qid]: '41' } }
  })

  assert.equal((await chat('quiz')).status, 200)
  const sent = requests.at(-1)
  const system = sent.messages[0].content
  const turn = sent.messages.at(-1).content
  assert.match(system, /ask mostly about the cards and questions they keep missing/)
  assert.match(turn, /<learning_state>/)
  assert.match(turn, /- "exhibit" \(from Unit 1 words; missed 2×\)/)
  assert.doesNotMatch(turn, /"survey"/)
  assert.match(turn, /- "What is 6 x 7\?" \(in Week 3 check\)/)
  assert.doesNotMatch(system, /exhibit/)
})
