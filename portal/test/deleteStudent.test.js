const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount, randomSecret } = require('./helpers')

test('deleting a student removes their login and work, not just the roster row', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const payload = classPayload({
    extra: { homeworkAssignments: [{ id: 'h1', classId: 'c1', title: 'Essay' }] }
  })
  const { cookie, username, password } = await makeStudentAccount(portal, { payload })
  const handedIn = await portal.call('POST', '/api/me/homework/h1/submit', {
    cookie,
    body: { studentId: 's1', textAnswer: 'My essay' }
  })
  assert.equal(handedIn.status, 200, handedIn.text)

  const res = await portal.sync('/delete-student', { studentId: 's1' })
  assert.equal(res.status, 200, res.text)
  assert.ok(res.json.removed > 0)

  assert.deepEqual((await portal.sync('/accounts')).json, [])
  assert.deepEqual((await portal.sync('/submissions')).json, [])
  const login = await portal.call('POST', '/api/auth/login', { body: { username, password } })
  assert.notEqual(login.status, 200)
})

test('a student who joined through a class link doesn’t come back after being deleted', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const p = classPayload()
  p.invites = [{ code: 'CLASS-LINK', classId: 'c1', revoked: false, kind: 'class_link' }]
  assert.equal((await portal.sync('', p)).status, 200)
  const joined = await portal.call('POST', '/api/invites/CLASS-LINK/redeem', {
    body: {
      firstName: 'Grace',
      lastName: 'Hopper',
      dateOfBirth: '2006-05-05',
      username: 'grace',
      password: randomSecret()
    }
  })
  assert.equal(joined.status, 200, joined.text)
  const [newcomer] = (await portal.sync('/new-students')).json
  assert.ok(newcomer)

  assert.equal((await portal.sync('/delete-student', { studentId: newcomer.id })).status, 200)
  assert.deepEqual((await portal.sync('/new-students')).json, [])
  const me = await portal.call('GET', '/api/me', { cookie: joined.cookie })
  assert.notEqual(me.status, 200)
})

test('another teacher’s student is refused', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  assert.equal((await portal.sync('', classPayload())).status, 200)
  const other = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name: 'Other teacher' }
  })
  assert.equal(other.status, 200, other.text)
  const refused = await portal.sync('/delete-student', { studentId: 's1' }, other.json.syncSecret)
  assert.equal(refused.status, 403)
  // Still there for its own teacher.
  assert.equal((await portal.sync('/delete-student', { studentId: 's1' })).json.removed > 0, true)
})

test('deleting needs a student id', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  assert.equal((await portal.sync('/delete-student', {})).status, 400)
})
