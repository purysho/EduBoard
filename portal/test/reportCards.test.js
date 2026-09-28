const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const pdf = (text) => Buffer.from(`%PDF-1.4\n% ${text}\n%%EOF\n`).toString('base64')

function twoStudentPayload() {
  // Ada has a login (made below); Grace is enrolled but hasn't joined the Portal.
  const payload = classPayload()
  payload.students.push({ id: 's2', firstName: 'Grace', lastName: 'Hopper', dateOfBirth: null })
  payload.enrollments.push({ studentId: 's2', classId: 'c1', status: 'active' })
  return payload
}

test('a family sees only their own child’s report card, and the teacher sees who opened it', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const payload = twoStudentPayload()
  const { cookie } = await makeStudentAccount(portal, { payload })

  for (const studentId of ['s1', 's2']) {
    const sent = await portal.sync('/report-cards', {
      classId: 'c1',
      studentId,
      title: 'Term 1 report',
      fileData: pdf(studentId)
    })
    assert.equal(sent.status, 200, sent.text)
  }

  let [status] = (await portal.sync('/report-cards?classId=c1')).json
  assert.equal(status.title, 'Term 1 report')
  assert.equal(status.sent, 2)
  assert.equal(status.audience, 1) // Grace has no login yet
  assert.equal(status.seenCount, 0)

  // Ada's family lists only Ada's card.
  const list = (await portal.call('GET', '/api/me/report-cards', { cookie })).json
  assert.equal(list.length, 1)
  assert.equal(list[0].studentName, 'Ada Lovelace')
  assert.equal(list[0].className, 'Biology 101')
  assert.equal(list[0].opened, false)

  // Grace's card can't be fetched by Ada's family, even with its id.
  const graceId = (await portal.call('GET', '/api/me/report-cards', { cookie })).json.find(
    (c) => c.studentId === 's2'
  )
  assert.equal(graceId, undefined)

  const file = await portal.call('GET', `/api/me/report-cards/${list[0].id}/file`, { cookie })
  assert.equal(file.status, 200)
  assert.equal(file.headers.get('content-type'), 'application/pdf')
  assert.match(file.text, /% s1/)
  ;[status] = (await portal.sync('/report-cards?classId=c1')).json
  assert.equal(status.seenCount, 1)
  assert.ok(status.students.find((s) => s.studentId === 's1').seenAt)
  assert.equal((await portal.call('GET', '/api/me/report-cards', { cookie })).json[0].opened, true)

  // Without signing in: nothing.
  const anon = await portal.call('GET', `/api/me/report-cards/${list[0].id}/file`)
  assert.equal(anon.status, 401)
})

test('sending a title again replaces the card, and it counts as unseen', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  const send = (text) =>
    portal.sync('/report-cards', {
      classId: 'c1',
      studentId: 's1',
      title: 'Term 1',
      fileData: pdf(text)
    })

  await send('first')
  const [first] = (await portal.call('GET', '/api/me/report-cards', { cookie })).json
  await portal.call('GET', `/api/me/report-cards/${first.id}/file`, { cookie })
  const again = await send('corrected')
  assert.equal(again.json.replaced, true)

  const cards = (await portal.call('GET', '/api/me/report-cards', { cookie })).json
  assert.equal(cards.length, 1)
  assert.equal(cards[0].opened, false)
  const file = await portal.call('GET', `/api/me/report-cards/${cards[0].id}/file`, { cookie })
  assert.match(file.text, /corrected/)
  // The old file is gone from the disk.
  assert.equal(fs.readdirSync(path.join(portal.dataDir, 'report-cards')).length, 1)
})

test('only PDFs for this teacher’s enrolled students are accepted; withdrawing removes them', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)

  const notPdf = await portal.sync('/report-cards', {
    classId: 'c1',
    studentId: 's1',
    title: 'T',
    fileData: Buffer.from('MZ not a pdf').toString('base64')
  })
  assert.equal(notPdf.status, 400)
  assert.equal(notPdf.json.code, 'PT-3006')
  const stranger = await portal.sync('/report-cards', {
    classId: 'c1',
    studentId: 'nobody',
    title: 'T',
    fileData: pdf('x')
  })
  assert.equal(stranger.status, 404)
  const wrongSecret = await portal.sync(
    '/report-cards',
    { classId: 'c1', studentId: 's1', title: 'T', fileData: pdf('x') },
    'wrong-secret-wrong-secret'
  )
  assert.equal(wrongSecret.status, 401)

  await portal.sync('/report-cards', {
    classId: 'c1',
    studentId: 's1',
    title: 'T',
    fileData: pdf('x')
  })
  const withdrawn = await portal.call('DELETE', '/api/sync/report-cards?classId=c1&title=T', {
    headers: { 'X-Sync-Secret': portal.secrets.sync }
  })
  assert.equal(withdrawn.json.removed, 1)
  assert.deepEqual((await portal.call('GET', '/api/me/report-cards', { cookie })).json, [])
  assert.equal(fs.readdirSync(path.join(portal.dataDir, 'report-cards')).length, 0)
})

test('a report card goes when its student is removed or its class is no longer published', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const payload = twoStudentPayload()
  await makeStudentAccount(portal, { payload })
  for (const studentId of ['s1', 's2']) {
    await portal.sync('/report-cards', {
      classId: 'c1',
      studentId,
      title: 'T',
      fileData: pdf(studentId)
    })
  }
  const dir = path.join(portal.dataDir, 'report-cards')
  assert.equal(fs.readdirSync(dir).length, 2)

  await portal.sync('/delete-student', { studentId: 's2' })
  assert.equal(fs.readdirSync(dir).length, 1)

  // The class is dropped from the next publish.
  await portal.sync('', { ...payload, classes: [], enrollments: [], grades: [], invites: [] })
  assert.equal(fs.readdirSync(dir).length, 0)
})
