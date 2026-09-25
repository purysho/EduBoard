const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Database = require('better-sqlite3')
const { startPortal, makeStudentAccount, randomSecret } = require('./helpers')

test('admin secret: wrong secrets are rejected and then throttled per IP', async (t) => {
  const portal = await startPortal({ RATE_BAD_SECRET_PER_IP: '3' })
  t.after(portal.stop)
  const admin = (secret) =>
    portal.call('GET', '/api/admin/teachers', { headers: { 'X-Admin-Secret': secret } })

  assert.equal((await admin(portal.secrets.admin)).status, 200)
  for (let i = 0; i < 3; i++) assert.equal((await admin(randomSecret())).status, 401)
  // Once blocked, even the right secret waits out the window: otherwise the lock would
  // just tell a guesser which attempt succeeded.
  const blocked = await admin(portal.secrets.admin)
  assert.equal(blocked.status, 429)
  assert.ok(Number(blocked.headers.get('retry-after')) > 0)
})

test('sync secret: only failures count toward the lockout', async (t) => {
  const portal = await startPortal({ RATE_BAD_SECRET_PER_IP: '3' })
  t.after(portal.stop)
  for (let i = 0; i < 10; i++) assert.equal((await portal.sync('/posts')).status, 200)
  for (let i = 0; i < 3; i++) {
    assert.equal((await portal.sync('/posts', undefined, randomSecret())).status, 401)
  }
  assert.equal((await portal.sync('/posts')).status, 429)
})

test('login: failures lock that username only, and the correct password waits it out', async (t) => {
  const portal = await startPortal({ RATE_LOGIN_FAILS_PER_USER: '3' })
  t.after(portal.stop)
  const { username, password } = await makeStudentAccount(portal)
  const login = (u, p) => portal.call('POST', '/api/auth/login', { body: { username: u, password: p } })

  for (let i = 0; i < 3; i++) assert.equal((await login(username, randomSecret())).status, 401)
  assert.equal((await login(username, password)).status, 429)
  // Case variations of the username share the same lock.
  assert.equal((await login(username.toUpperCase(), password)).status, 429)
  // A different username is unaffected.
  assert.equal((await login('someone-else', randomSecret())).status, 401)
})

test('login: per-IP limit applies across usernames', async (t) => {
  const portal = await startPortal({ RATE_LOGIN_PER_IP: '5' })
  t.after(portal.stop)
  for (let i = 0; i < 5; i++) {
    const res = await portal.call('POST', '/api/auth/login', {
      body: { username: `user${i}`, password: randomSecret() }
    })
    assert.equal(res.status, 401)
  }
  const res = await portal.call('POST', '/api/auth/login', {
    body: { username: 'user-next', password: randomSecret() }
  })
  assert.equal(res.status, 429)
})

test('invite codes: guessing is throttled per IP', async (t) => {
  const portal = await startPortal({ RATE_SECRET_URL_PER_IP: '5' })
  t.after(portal.stop)
  for (let i = 0; i < 5; i++) {
    assert.equal((await portal.call('GET', `/api/invites/GUESS${i}`)).status, 404)
  }
  assert.equal((await portal.call('GET', '/api/invites/GUESS9')).status, 429)
})

test('signup enforces a minimum password length', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  await portal.sync('', require('./helpers').classPayload())
  const res = await portal.call('POST', '/api/invites/INV1/redeem', {
    body: { studentId: 's1', username: 'ada', password: 'short' }
  })
  assert.equal(res.status, 400)
  assert.match(res.json.error, /at least 8/)
})

test('changing your password signs out every other session', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie: sessionA, username, password } = await makeStudentAccount(portal)
  const sessionB = (
    await portal.call('POST', '/api/auth/login', { body: { username, password } })
  ).cookie
  assert.equal((await portal.call('GET', '/api/me', { cookie: sessionB })).status, 200)

  const wrong = await portal.call('POST', '/api/me/password', {
    cookie: sessionA,
    body: { currentPassword: randomSecret(), newPassword: randomSecret() }
  })
  assert.equal(wrong.status, 400)

  const newPassword = randomSecret()
  const changed = await portal.call('POST', '/api/me/password', {
    cookie: sessionA,
    body: { currentPassword: password, newPassword }
  })
  assert.equal(changed.status, 200)
  assert.ok(changed.cookie, 'the browser that changed it gets a fresh cookie')

  assert.equal((await portal.call('GET', '/api/me', { cookie: sessionB })).status, 401)
  assert.equal((await portal.call('GET', '/api/me', { cookie: sessionA })).status, 401)
  assert.equal((await portal.call('GET', '/api/me', { cookie: changed.cookie })).status, 200)
  const relogin = await portal.call('POST', '/api/auth/login', {
    body: { username, password: newPassword }
  })
  assert.equal(relogin.status, 200)
})

test("a teacher's password reset signs the student out everywhere, QR codes included", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie, username } = await makeStudentAccount(portal)
  const newPassword = randomSecret()
  assert.equal((await portal.call('POST', '/api/me/qr', { cookie, body: {} })).status, 200)
  const activeQrCodes = () =>
    new Database(path.join(portal.dataDir, 'portal.db'), { readonly: true })
      .prepare('SELECT COUNT(*) AS n FROM qr_tokens WHERE revoked = 0')
      .get().n
  assert.equal(activeQrCodes(), 1)

  assert.equal((await portal.sync('/reset-password', { username, newPassword: 'short' })).status, 400)
  assert.equal((await portal.sync('/reset-password', { username, newPassword })).status, 200)
  assert.equal((await portal.call('GET', '/api/me', { cookie })).status, 401)
  assert.equal(activeQrCodes(), 0)
  const login = await portal.call('POST', '/api/auth/login', {
    body: { username, password: newPassword }
  })
  assert.equal(login.status, 200)
})

test("a teacher cannot reset another teacher's student's password", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { username } = await makeStudentAccount(portal)
  const other = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name: 'Other teacher' }
  })
  const res = await portal.sync(
    '/reset-password',
    { username, newPassword: randomSecret() },
    other.json.syncSecret
  )
  assert.equal(res.status, 404)
})

test('AI endpoints have a per-account burst limit', async (t) => {
  const portal = await startPortal({ RATE_AI_PER_MINUTE: '2' })
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  const ask = () =>
    portal.call('POST', '/api/me/ai/chat', { cookie, body: { studentId: 's1', message: 'hi' } })
  // No AI key is configured in tests, so allowed calls answer 503, not 200. What matters
  // is that the limit is enforced before the provider would ever be called.
  assert.equal((await ask()).status, 503)
  assert.equal((await ask()).status, 503)
  const limited = await ask()
  assert.equal(limited.status, 429)
  assert.match(limited.json.error, /too quickly/)
})

test('responses carry security headers and errors never leak stack traces', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const health = await portal.call('GET', '/health')
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(health.headers.get('x-frame-options'), 'DENY')
  assert.equal(health.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(health.headers.get('x-powered-by'), null)

  const malformed = await portal.call('POST', '/api/auth/login', { body: '{not json' })
  assert.equal(malformed.status, 400)
  assert.deepEqual(malformed.json, { error: 'Malformed request.' })
  assert.doesNotMatch(malformed.text, /at \//)

  const missing = await portal.call('GET', '/api/nope')
  assert.equal(missing.status, 404)
  assert.deepEqual(missing.json, { error: 'Not found' })
})

test('X-Forwarded-For is ignored unless the request comes from a trusted proxy', async (t) => {
  // Tests connect over loopback, which is trusted by default, so set TRUST_PROXY to
  // "false" to model a direct internet client that tries to spoof its IP.
  const portal = await startPortal({ RATE_LOGIN_PER_IP: '3', TRUST_PROXY: 'false' })
  t.after(portal.stop)
  for (let i = 0; i < 3; i++) {
    await portal.call('POST', '/api/auth/login', {
      headers: { 'X-Forwarded-For': `203.0.113.${i}` },
      body: { username: `u${i}`, password: randomSecret() }
    })
  }
  const res = await portal.call('POST', '/api/auth/login', {
    headers: { 'X-Forwarded-For': '203.0.113.99' },
    body: { username: 'u9', password: randomSecret() }
  })
  assert.equal(res.status, 429)
})
