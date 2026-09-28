const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

function twoStudentPayload() {
  // Ada has a login; Grace is enrolled but hasn't joined the Portal.
  const payload = classPayload()
  payload.students.push({ id: 's2', firstName: 'Grace', lastName: 'Hopper', dateOfBirth: null })
  payload.enrollments.push({ studentId: 's2', classId: 'c1', status: 'active' })
  return payload
}

test('a yes / no reply slip: families answer, the teacher sees who said what', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, { payload: twoStudentPayload() })

  const made = await portal.sync('/posts', {
    classId: 'c1',
    body: 'Museum trip on Friday.',
    replyKind: 'yesno',
    replyQuestion: 'May Ada come?'
  })
  assert.equal(made.status, 200)

  let [post] = (await portal.sync('/posts')).json
  assert.equal(post.replyKind, 'yesno')
  assert.equal(post.replyQuestion, 'May Ada come?')
  assert.deepEqual(post.replies, { ack: 0, yes: 0, no: 0 })
  assert.deepEqual(post.notReplied, ['Ada Lovelace'])

  const [feed] = (await portal.call('GET', '/api/me/posts', { cookie })).json
  assert.equal(feed.replyQuestion, 'May Ada come?')
  assert.deepEqual(
    feed.replyFor.map((c) => [c.studentId, c.answer]),
    [['s1', null]]
  )

  const reply = (body) => portal.call('POST', `/api/me/posts/${feed.id}/reply`, { cookie, body })
  assert.equal((await reply({ studentId: 's1', answer: 'ack' })).status, 400) // not a yes/no
  assert.equal((await reply({ studentId: 's2', answer: 'yes' })).status, 403) // not their child
  assert.equal((await reply({ studentId: 's1', answer: 'no' })).status, 200)
  assert.equal((await reply({ studentId: 's1', answer: 'yes' })).status, 200) // changed their mind

  ;[post] = (await portal.sync('/posts')).json
  assert.deepEqual(post.replies, { ack: 0, yes: 1, no: 0 })
  assert.deepEqual(post.answeredYes, ['Ada Lovelace'])
  assert.deepEqual(post.notReplied, [])
})

test('reminders go only to families who haven’t replied', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  await portal.sync('/posts', {
    classId: 'c1',
    body: 'Please read the new rules.',
    replyKind: 'ack'
  })
  const [post] = (await portal.sync('/posts')).json

  const remind = () =>
    portal.call('POST', `/api/sync/posts/${post.id}/remind`, {
      body: { message: 'Reminder: please reply to the notice in Class Story.' },
      headers: { 'X-Sync-Secret': portal.secrets.sync }
    })
  assert.equal((await remind()).json.reminded, 1)
  const thread = (await portal.call('GET', '/api/me/messages', { cookie })).json
  assert.equal(thread.at(-1).body, 'Reminder: please reply to the notice in Class Story.')

  const [feed] = (await portal.call('GET', '/api/me/posts', { cookie })).json
  await portal.call('POST', `/api/me/posts/${feed.id}/reply`, {
    cookie,
    body: { studentId: 's1', answer: 'ack' }
  })
  assert.equal((await remind()).json.reminded, 0)
  const [after] = (await portal.sync('/posts')).json
  assert.equal(after.replies.ack, 1)
})

test('a post without a reply slip has none, and can’t be answered', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  await portal.sync('/posts', { classId: 'c1', body: 'Photos from today' })
  const [post] = (await portal.sync('/posts')).json
  assert.equal(post.replyKind, undefined)
  const [feed] = (await portal.call('GET', '/api/me/posts', { cookie })).json
  assert.equal(feed.replyFor, undefined)
  const res = await portal.call('POST', `/api/me/posts/${feed.id}/reply`, {
    cookie,
    body: { studentId: 's1', answer: 'ack' }
  })
  assert.equal(res.status, 404)
})
