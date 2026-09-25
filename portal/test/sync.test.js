const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const b64 = (s) => Buffer.from(s).toString('base64')

async function addTeacher(portal, name) {
  const res = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name }
  })
  return res.json.syncSecret
}

test('the full family path works: publish, redeem, dashboard, attachment, quick check', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const homework = {
    id: 'h1',
    classId: 'c1',
    title: 'Worksheet',
    fileName: 'ws.txt',
    fileData: b64('attachment body'),
    questions: [{ type: 'short_answer', prompt: '2+2', correctAnswer: '4', points: 1 }]
  }
  const payload = classPayload({ extra: { homeworkAssignments: [homework] } })
  const { cookie } = await makeStudentAccount(portal, { payload })

  const me = await portal.call('GET', '/api/me', { cookie })
  const cls = me.json.students[0].classes[0]
  assert.equal(cls.name, 'Biology 101')
  assert.equal(cls.homework[0].title, 'Worksheet')
  assert.ok(!('correctAnswer' in cls.homework[0].questions[0]), 'answers never reach the browser')

  const file = await portal.call('GET', '/api/me/homework/h1/file', { cookie })
  assert.equal(file.text, 'attachment body')

  const qid = cls.homework[0].questions[0].id
  const graded = await portal.call('POST', '/api/me/homework/h1/answers', {
    cookie,
    body: { studentId: 's1', answers: { [qid]: ' 4 ' } }
  })
  assert.equal(graded.json.grade, '1/1')
})

test("one teacher's publish never deletes another teacher's attachments", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const secretB = await addTeacher(portal, 'B')
  const hw = (id, classId, name) => ({ id, classId, title: id, fileName: name, fileData: b64(id) })

  await portal.sync('', {
    classes: [{ id: 'cA', name: 'A', levelType: 'university' }],
    homeworkAssignments: [hw('hA', 'cA', 'a.txt')]
  })
  await portal.sync(
    '',
    {
      classes: [{ id: 'cB', name: 'B', levelType: 'university' }],
      homeworkAssignments: [hw('hB', 'cB', 'b.txt')]
    },
    secretB
  )
  const uploads = fs.readdirSync(path.join(portal.dataDir, 'homework-uploads')).sort()
  assert.deepEqual(uploads, ['hA-a.txt', 'hB-b.txt'])

  // Teacher A dropping their assignment removes only their own file.
  await portal.sync('', { classes: [{ id: 'cA', name: 'A', levelType: 'university' }] })
  assert.deepEqual(fs.readdirSync(path.join(portal.dataDir, 'homework-uploads')), ['hB-b.txt'])
})

test("a teacher's sync secret cannot write into another teacher's class", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const secretB = await addTeacher(portal, 'B')
  const { cookie } = await makeStudentAccount(portal)
  await portal.sync(
    '',
    {
      classes: [{ id: 'cB', name: 'B', levelType: 'university' }],
      homeworkAssignments: [{ id: 'hEvil', classId: 'c1', title: 'Injected' }],
      grades: [{ studentId: 's1', classId: 'c1', percent: 0 }]
    },
    secretB
  )
  const cls = (await portal.call('GET', '/api/me', { cookie })).json.students[0].classes[0]
  assert.equal(cls.homework.length, 0)
  assert.equal(cls.percent, 91)
})

test('a material still shared to an archived class never breaks later publishes', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const material = { id: 'm1', classId: 'c2', title: 'Cells', chunks: ['mitochondria'] }
  const c1 = { id: 'c1', name: 'One', levelType: 'university' }
  const c2 = { id: 'c2', name: 'Two', levelType: 'university' }

  assert.equal((await portal.sync('', { classes: [c1, c2], materials: [material] })).status, 200)
  // c2 archived: the desktop stops sending the class but still sends the material.
  for (let i = 0; i < 3; i++) {
    assert.equal((await portal.sync('', { classes: [c1], materials: [material] })).status, 200)
  }
  // Un-archived again.
  assert.equal((await portal.sync('', { classes: [c1, c2], materials: [material] })).status, 200)
})

test('"send digest now" responds instead of crashing', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const res = await portal.sync('/digest/send-now', {})
  assert.equal(res.status, 200)
  assert.deepEqual(res.json, { sent: 0, total: 0, errors: [] })
})
