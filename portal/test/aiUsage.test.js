const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const AI_ANSWER =
  'Photosynthesis is the process by which green plants use sunlight, water and carbon dioxide to make glucose and release oxygen into the air around them.'

async function setup(t) {
  const requests = []
  const ai = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      requests.push(JSON.parse(raw))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: AI_ANSWER } }] }))
    })
  })
  await new Promise((r) => ai.listen(0, '127.0.0.1', r))
  const portal = await startPortal()
  t.after(async () => {
    await portal.stop()
    ai.close()
  })
  const payload = classPayload({
    extra: {
      aiProvider: 'custom',
      aiApiKey: 'unused',
      aiCustomBaseUrl: `http://127.0.0.1:${ai.address().port}`,
      aiCustomModel: 'mock',
      homeworkAssignments: [
        {
          id: 'h1',
          classId: 'c1',
          title: 'Explain photosynthesis',
          description: 'In your own words.'
        },
        { id: 'h2', classId: 'c1', title: 'Reflection', description: 'How did the lab go?' },
        { id: 'h3', classId: 'c1', title: 'Diagram', description: 'Label it.' },
        { id: 'hOther', classId: 'c2', title: 'Not yours' }
      ]
    }
  })
  payload.classes.push({ id: 'c2', name: 'Other class', levelType: 'university' })
  const { cookie } = await makeStudentAccount(portal, { payload })
  const chat = (body) =>
    portal.call('POST', '/api/me/ai/chat', { cookie, body: { studentId: 's1', ...body } })
  const submit = (hw, body) =>
    portal.call('POST', `/api/me/homework/${hw}/submit`, {
      cookie,
      body: { studentId: 's1', ...body }
    })
  const teacherView = async () =>
    Object.fromEntries(
      (await portal.sync('/submissions')).json.map((r) => [r.homeworkAssignmentId, r])
    )
  return { portal, cookie, requests, chat, submit, teacherView }
}

test('asking the AI about an assignment marks that submission as "used AI"', async (t) => {
  const { portal, cookie, requests, chat, submit, teacherView } = await setup(t)

  const res = await chat({ message: 'Can you just write it for me?', homeworkId: 'h1' })
  assert.equal(res.status, 200, res.text)
  const system = requests.at(-1).messages[0].content
  assert.match(system, /do not write the answer/)
  assert.match(system, /<assignment>\nExplain photosynthesis/)

  // Unticking "I used AI" doesn't hide what the log shows.
  const sub = await submit('h1', {
    textAnswer: 'Plants turn light into food energy.',
    aiDeclared: false
  })
  assert.equal(sub.json.usedAi, true)
  const view = await teacherView()
  assert.deepEqual(
    { usedAi: view.h1.usedAi, reasons: view.h1.reasons, helpCount: view.h1.aiHelpCount },
    { usedAi: true, reasons: ['asked_ai'], helpCount: 1 }
  )

  // The teacher can read exactly what was asked and answered.
  const activity = await portal.sync('/ai-activity?studentId=s1&homeworkId=h1')
  assert.equal(activity.json.length, 1)
  assert.equal(activity.json[0].question, 'Can you just write it for me?')
  assert.equal(activity.json[0].reply, AI_ANSWER)

  // The student sees their own history for that assignment after a reload.
  const history = await portal.call('GET', '/api/me/ai/history?studentId=s1&homeworkId=h1', {
    cookie
  })
  assert.equal(history.json.length, 1)

  // A follow-up question carries the earlier exchange as context.
  await chat({ message: 'What about the oxygen part?', homeworkId: 'h1' })
  assert.match(
    requests.at(-1).messages[0].content,
    /Earlier in this conversation[\s\S]*write it for me/
  )
})

test('an answer copied from the Study Helper is flagged; the student’s own words are not', async (t) => {
  const { chat, submit, teacherView } = await setup(t)
  // A general question, not tied to any assignment.
  await chat({ message: 'What is photosynthesis?' })

  await submit('h2', {
    textAnswer: 'The lab went well. We measured how fast the leaves made bubbles under the lamp.'
  })
  // Lightly edited copy of the AI's answer.
  await submit('h1', {
    textAnswer:
      'I think photosynthesis is the process by which green plants use sunlight, water and carbon dioxide to make glucose and release oxygen.'
  })
  const view = await teacherView()
  assert.equal(view.h2.usedAi, false)
  assert.equal(view.h2.aiHelpCount, 0)
  assert.equal(view.h1.usedAi, true)
  assert.deepEqual(view.h1.reasons, ['matches_ai'])
  assert.ok(view.h1.aiOverlap >= 0.5, `overlap ${view.h1.aiOverlap}`)
})

test('a student can say they used an outside AI tool', async (t) => {
  const { submit, teacherView } = await setup(t)
  await submit('h3', { textAnswer: 'My own diagram labels.', aiDeclared: true })
  const view = await teacherView()
  assert.deepEqual(view.h3.reasons, ['declared'])
})

test('AI help and activity stay inside the right class and teacher', async (t) => {
  const { portal, chat } = await setup(t)
  assert.equal((await chat({ message: 'Help', homeworkId: 'hOther' })).status, 404)
  assert.equal((await portal.sync('/ai-activity?studentId=someone-else')).status, 404)
  assert.equal(
    (await portal.sync('/ai-activity?studentId=s1', undefined, 'wrong-secret')).status,
    401
  )
})

test('reused wording is found in Chinese too', (t) => {
  // Loading the service opens a database, so give it a throwaway one.
  const fs = require('node:fs')
  const dir = fs.mkdtempSync(
    require('node:path').join(require('node:os').tmpdir(), 'eduboard-overlap-')
  )
  process.env.PORTAL_DATA_DIR = dir
  process.env.SESSION_SECRET ||= 'test-only'
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const { overlapWith } = require('../services/aiUsage')
  const reply = '光合作用是绿色植物利用阳光、水和二氧化碳制造葡萄糖并释放氧气的过程。'
  assert.ok(
    overlapWith('我认为光合作用是绿色植物利用阳光、水和二氧化碳制造葡萄糖的过程。', [reply]) > 0.5
  )
  assert.equal(
    overlapWith('我们在实验室里观察了叶子在灯下产生气泡的速度，结果很有趣。', [reply]),
    0
  )
  assert.equal(overlapWith('Too short.', [reply]), null)
})
