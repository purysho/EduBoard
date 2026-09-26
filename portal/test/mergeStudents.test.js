const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload } = require('./helpers')

const PASSWORD = 'a-good-password'

test('a class-link join matches the roster name written family-name first', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const p = classPayload()
  p.students[0] = { id: 's1', firstName: 'Mai', lastName: 'Chen', dateOfBirth: null }
  p.invites = [{ code: 'CLASS-LINK', classId: 'c1', revoked: false, kind: 'class_link' }]
  assert.equal((await portal.sync('', p)).status, 200)
  const res = await portal.call('POST', '/api/invites/CLASS-LINK/redeem', {
    body: {
      firstName: 'Chen',
      lastName: 'Mai',
      dateOfBirth: '2006-05-05',
      username: 'maimai',
      password: PASSWORD
    }
  })
  assert.equal(res.status, 200, res.text)
  // Matched to the roster's Mai Chen, not added as a second student.
  assert.deepEqual((await portal.sync('/new-students')).json, [])
  assert.deepEqual((await portal.sync('/accounts')).json, ['s1'])
})

test('merging moves the duplicate’s login and work to the kept student', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const p = classPayload()
  p.students.push({ id: 'dup', firstName: 'Lovelace', lastName: 'Ada', dateOfBirth: null })
  p.enrollments.push({ studentId: 'dup', classId: 'c1', status: 'active' })
  p.homeworkAssignments = [{ id: 'h1', classId: 'c1', title: 'Essay' }]
  p.invites = [
    { code: 'DUP-LINK', classId: 'c1', revoked: false, kind: 'student', studentId: 'dup' }
  ]
  assert.equal((await portal.sync('', p)).status, 200)
  const joined = await portal.call('POST', '/api/invites/DUP-LINK/redeem', {
    body: { username: 'ada', password: PASSWORD }
  })
  assert.equal(joined.status, 200, joined.text)
  await portal.call('POST', '/api/me/homework/h1/submit', {
    cookie: joined.cookie,
    body: { studentId: 'dup', textAnswer: 'My essay' }
  })

  const merged = await portal.sync('/merge-students', { from: 'dup', into: 's1' })
  assert.equal(merged.status, 200, merged.text)
  // The desktop then publishes without the duplicate.
  p.students = p.students.filter((s) => s.id !== 'dup')
  p.enrollments = p.enrollments.filter((e) => e.studentId !== 'dup')
  p.invites = []
  assert.equal((await portal.sync('', p)).status, 200)

  const me = await portal.call('GET', '/api/me', { cookie: joined.cookie })
  assert.equal(me.json.students.length, 1)
  assert.equal(me.json.students[0].studentId, 's1')
  assert.equal(me.json.students[0].classes[0].homework[0].textAnswer, 'My essay')
})
