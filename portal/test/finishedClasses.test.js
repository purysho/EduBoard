const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload } = require('./helpers')

const PASSWORD = 'a-good-password'

function payload(finished) {
  const p = classPayload()
  p.classes[0].finished = finished
  p.homeworkAssignments = [{ id: 'h1', classId: 'c1', title: 'Week 1 essay' }]
  p.invites = [
    { code: 'ADA-LINK', classId: 'c1', revoked: false, kind: 'student', studentId: 's1' },
    { code: 'CLASS-LINK', classId: 'c1', revoked: false, kind: 'class_link' }
  ]
  return p
}

test('a finished class stays visible read-only: no hand-ins, no joining', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  assert.equal((await portal.sync('', payload(false))).status, 200)
  const joined = await portal.call('POST', '/api/invites/ADA-LINK/redeem', {
    body: { username: 'ada', password: PASSWORD }
  })
  assert.equal(joined.status, 200, joined.text)
  const cookie = joined.cookie
  const submit = () =>
    portal.call('POST', '/api/me/homework/h1/submit', {
      cookie,
      body: { studentId: 's1', textAnswer: 'My essay' }
    })
  assert.equal((await submit()).status, 200)

  // End of term: the teacher archives the class and publishes.
  assert.equal((await portal.sync('', payload(true))).status, 200)
  const me = await portal.call('GET', '/api/me', { cookie })
  const cls = me.json.students[0].classes[0]
  assert.equal(cls.finished, true)
  assert.equal(cls.homework[0].textAnswer, 'My essay')

  const late = await submit()
  assert.equal(late.status, 403)
  assert.match(late.json.error, /finished/)
  assert.equal((await portal.call('GET', '/api/invites/CLASS-LINK')).status, 404)
})
