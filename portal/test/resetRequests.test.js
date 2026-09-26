const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, makeStudentAccount } = require('./helpers')

test('forgot password: the student asks, the teacher approves, the student chooses a new one', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const old = await makeStudentAccount(portal, { username: 'ada' })

  const ask = await portal.call('POST', '/api/auth/reset-request', { body: { username: 'ada' } })
  assert.equal(ask.status, 200)
  const { id, secret } = ask.json
  const status = () =>
    portal.call('POST', `/api/auth/reset-request/${id}/status`, { body: { secret } })
  assert.equal((await status()).json.status, 'pending')

  // Not approved yet: no new password.
  const early = await portal.call('POST', `/api/auth/reset-request/${id}/complete`, {
    body: { secret, newPassword: 'a-brand-new-password' }
  })
  assert.equal(early.status, 403)

  const waiting = await portal.sync('/reset-requests')
  assert.equal(waiting.json.length, 1)
  assert.equal(waiting.json[0].username, 'ada')
  assert.deepEqual(waiting.json[0].studentNames, ['Ada Lovelace'])
  assert.equal((await portal.sync(`/reset-requests/${id}`, { approve: true })).status, 200)
  assert.equal((await status()).json.status, 'approved')

  // Someone without the request's secret can't use the approval.
  const stranger = await portal.call('POST', `/api/auth/reset-request/${id}/complete`, {
    body: { secret: 'guess', newPassword: 'a-brand-new-password' }
  })
  assert.equal(stranger.status, 403)

  const done = await portal.call('POST', `/api/auth/reset-request/${id}/complete`, {
    body: { secret, newPassword: 'a-brand-new-password' }
  })
  assert.equal(done.status, 200, done.text)
  assert.equal((await portal.call('GET', '/api/me', { cookie: done.cookie })).status, 200)
  // The old session is signed out, the new password works, the request is spent.
  assert.equal((await portal.call('GET', '/api/me', { cookie: old.cookie })).status, 401)
  const login = await portal.call('POST', '/api/auth/login', {
    body: { username: 'ada', password: 'a-brand-new-password' }
  })
  assert.equal(login.status, 200)
  assert.equal((await status()).json.status, 'used')
  assert.deepEqual((await portal.sync('/reset-requests')).json, [])
})

test('asking about an unknown username looks the same, and never reaches a teacher', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  await makeStudentAccount(portal, { username: 'ada' })
  const ask = await portal.call('POST', '/api/auth/reset-request', { body: { username: 'nobody' } })
  assert.equal(ask.status, 200)
  assert.ok(ask.json.secret)
  assert.deepEqual((await portal.sync('/reset-requests')).json, [])
})

test('a teacher can only answer requests for their own students', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  await makeStudentAccount(portal, { username: 'ada' })
  const { id } = (
    await portal.call('POST', '/api/auth/reset-request', { body: { username: 'ada' } })
  ).json
  const declined = await portal.sync(`/reset-requests/${id}`, { approve: false })
  assert.equal(declined.json.status, 'declined')
  assert.equal((await portal.sync(`/reset-requests/${id}`, { approve: true })).status, 404)
})
