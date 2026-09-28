const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, makeStudentAccount } = require('./helpers')

async function signIn(portal) {
  const res = await portal.call('POST', '/api/auth/login', {
    body: { username: 'demo', password: 'try-eduboard' }
  })
  assert.equal(res.status, 200, res.text)
  return res.cookie
}

test('with PORTAL_DEMO=1, anyone can sign in as demo and see a made-up class', async (t) => {
  const portal = await startPortal({ PORTAL_DEMO: '1' })
  t.after(portal.stop)
  assert.deepEqual((await portal.call('GET', '/api/demo')).json, {
    enabled: true,
    username: 'demo',
    password: 'try-eduboard'
  })
  const cookie = await signIn(portal)
  const me = (await portal.call('GET', '/api/me', { cookie })).json
  assert.equal(me.students[0].studentName, 'Amy Chen')
  assert.equal(me.students[0].classes[0].letter, 'A')
  const posts = (await portal.call('GET', '/api/me/posts', { cookie })).json
  assert.ok(posts.some((p) => p.replyKind === 'yesno'))
  const [card] = (await portal.call('GET', '/api/me/report-cards', { cookie })).json
  const pdf = await portal.call('GET', `/api/me/report-cards/${card.id}/file`, { cookie })
  assert.equal(pdf.status, 200)
  assert.match(pdf.text, /^%PDF-1\.4/)
  assert.match(pdf.text, /%%EOF/)

  // Nobody can lock the others out or attach their own email or QR login.
  for (const [p, body] of [
    ['/api/me/password', { currentPassword: 'try-eduboard', newPassword: 'mine-now-123456' }],
    ['/api/me/account', { email: 'me@example.com' }],
    ['/api/me/qr', {}]
  ]) {
    const res = await portal.call('POST', p, { cookie, body })
    assert.equal(res.status, 403, p)
    assert.equal(res.json.code, 'PT-1009')
  }
  assert.equal((await signIn(portal)).length > 0, true)
})

test('without PORTAL_DEMO there is no demo login', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  assert.deepEqual((await portal.call('GET', '/api/demo')).json, { enabled: false })
  const res = await portal.call('POST', '/api/auth/login', {
    body: { username: 'demo', password: 'try-eduboard' }
  })
  assert.equal(res.status, 401)
})

test('the demo is left out of the admin page’s usage numbers', async (t) => {
  const portal = await startPortal({ PORTAL_DEMO: '1' })
  t.after(portal.stop)
  await makeStudentAccount(portal) // one real student, with a login
  const cookie = await signIn(portal)
  await portal.call('GET', '/api/me/posts', { cookie }) // demo activity this week
  const res = await portal.call('GET', '/api/admin/adoption', {
    headers: { 'X-Admin-Secret': portal.secrets.admin }
  })
  assert.equal(res.json.totals.students, 1)
  assert.equal(res.json.totals.studentsWithLogin, 1)
  assert.equal(res.json.totals.teachers, 1)
  assert.equal(res.json.weeks.at(-1).families, 0)
})
