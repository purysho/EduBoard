const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, makeStudentAccount } = require('./helpers')

test('a family agrees to the terms once, and the school can see who agreed', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  assert.equal((await portal.call('GET', '/api/me', { cookie })).json.consentNeeded, true)

  const agree = (body) => portal.call('POST', '/api/me/consent', { cookie, body })
  assert.equal((await agree({})).json.code, 'PT-1010')
  assert.equal((await agree({ role: 'guardian', name: '   ' })).status, 400)
  assert.equal((await agree({ role: 'guardian', name: 'Mrs Lovelace' })).status, 200)
  assert.equal((await portal.call('GET', '/api/me', { cookie })).json.consentNeeded, false)

  const records = await portal.call('GET', '/api/admin/consents', {
    headers: { 'X-Admin-Secret': portal.secrets.admin }
  })
  assert.equal(records.status, 200)
  assert.equal(records.json.length, 1)
  assert.equal(records.json[0].children, 'Ada Lovelace')
  assert.equal(records.json[0].agreedBy, 'Mrs Lovelace')
  assert.match(records.json[0].agreedAt, /^\d{4}-\d{2}-\d{2}T/)
  // Only for the admin.
  assert.equal((await portal.call('GET', '/api/admin/consents')).status, 401)
})

test('a student aged 14 or over can agree themselves; a school can turn the question off', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  await portal.call('POST', '/api/me/consent', { cookie, body: { role: 'student' } })
  assert.equal((await portal.call('GET', '/api/me', { cookie })).json.consentNeeded, false)

  const off = await startPortal({ PORTAL_CONSENT: 'off' })
  t.after(off.stop)
  const other = await makeStudentAccount(off)
  assert.equal(
    (await off.call('GET', '/api/me', { cookie: other.cookie })).json.consentNeeded,
    false
  )
})

test('Download my data returns everything about the family, and only theirs', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal)
  await portal.call('POST', '/api/me/messages', { cookie, body: { body: 'Hello teacher' } })
  const res = await portal.call('GET', '/api/me/export', { cookie })
  assert.equal(res.status, 200)
  assert.match(
    res.headers.get('content-disposition'),
    /attachment; filename="eduboard-portal-data-ada\.json"/
  )
  const data = res.json
  assert.equal(data.account.username, 'ada')
  assert.equal(data.children.length, 1)
  assert.equal(data.children[0].name, 'Ada Lovelace')
  assert.equal(data.children[0].classes[0].name, 'Biology 101')
  assert.equal(data.children[0].classes[0].letter, 'A')
  assert.equal(data.messages.at(-1).body, 'Hello teacher')
  assert.equal((await portal.call('GET', '/api/me/export')).status, 401)
})

test('Download my data works for a username in Chinese', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, { username: '王小明' })
  const res = await portal.call('GET', '/api/me/export', { cookie })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-disposition'), /filename="eduboard-portal-data\.json"/)
  assert.equal(res.json.account.username, '王小明')
  assert.equal(res.json.children[0].profile.studentId, 's1')
})
