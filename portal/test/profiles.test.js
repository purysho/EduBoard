const test = require('node:test')
const assert = require('node:assert/strict')
const sharp = require('sharp')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')
const { parseBirthDate } = require('../services/profile')

async function twoStudents(portal) {
  const payload = classPayload()
  payload.students.push({ id: 's2', firstName: 'Bo', lastName: 'Chen', dateOfBirth: null })
  payload.enrollments.push({ studentId: 's2', classId: 'c1', status: 'active' })
  payload.invites.push({ code: 'INV2', classId: 'c1', revoked: false })
  const ada = await makeStudentAccount(portal, { payload })
  const bo = await portal.call('POST', '/api/invites/INV2/redeem', {
    body: { studentId: 's2', username: 'bochen', password: 'bo-password-1' }
  })
  assert.equal(bo.status, 200, bo.text)
  return { ada: ada.cookie, bo: bo.cookie }
}

const jpeg = () =>
  sharp({ create: { width: 900, height: 700, channels: 3, background: '#cc6633' } })
    .jpeg()
    .toBuffer()

test('a student fills in and edits their own profile; blanks clear fields', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { ada } = await twoStudents(portal)

  const empty = (await portal.call('GET', '/api/me/profiles', { cookie: ada })).json
  assert.equal(empty.length, 1)
  assert.equal(empty[0].bio, null)

  const saved = await portal.call('PUT', '/api/me/profiles/s1', {
    cookie: ada,
    body: {
      preferredName: '  Ada  ',
      pronouns: 'she/her',
      bio: 'Maths and poetry.',
      dateOfBirth: '2005-12-10',
      shareBirthday: true,
      goals: 'Get better at proofs',
      teacherNote: 'I sit near the front for my eyesight.',
      preferredLanguage: 'Mandarin',
      privateNotes: 'Revise chapter 3 before Friday',
      isAdmin: true
    }
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.json.preferredName, 'Ada')
  assert.equal(saved.json.privateNotes, 'Revise chapter 3 before Friday')
  assert.ok(!('isAdmin' in saved.json))

  const cleared = await portal.call('PUT', '/api/me/profiles/s1', {
    cookie: ada,
    body: { bio: '   ' }
  })
  assert.equal(cleared.json.bio, null)
  assert.equal(cleared.json.pronouns, 'she/her', 'fields not sent are left alone')
})

test('profile input is validated', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { ada } = await twoStudents(portal)
  const put = (body) => portal.call('PUT', '/api/me/profiles/s1', { cookie: ada, body })
  assert.equal((await put({ bio: 'x'.repeat(601) })).status, 400)
  assert.equal((await put({ pronouns: 42 })).status, 400)
  assert.equal((await put({ dateOfBirth: '2005-02-30' })).status, 400)
  assert.equal((await put({ dateOfBirth: '2999-01-01' })).status, 400)
  assert.equal((await put({ dateOfBirth: '10/12/2005' })).status, 400)
  assert.equal((await put({ dateOfBirth: '' })).status, 200)
})

test('birth date parsing', () => {
  const today = new Date('2026-09-25T00:00:00Z')
  assert.equal(parseBirthDate('2004-02-29', today), '2004-02-29')
  assert.equal(parseBirthDate('2005-02-29', today), null)
  assert.equal(parseBirthDate('1899-12-31', today), null)
  assert.equal(parseBirthDate('2026-09-26', today), null)
})

test("no one can read or change another student's profile", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { ada, bo } = await twoStudents(portal)
  await portal.call('PUT', '/api/me/profiles/s1', { cookie: ada, body: { privateNotes: 'secret' } })

  assert.equal(
    (await portal.call('PUT', '/api/me/profiles/s1', { cookie: bo, body: { bio: 'hacked' } }))
      .status,
    404
  )
  assert.equal((await portal.call('GET', '/api/me/profiles/s1/photo', { cookie: bo })).status, 404)
  const boProfiles = (await portal.call('GET', '/api/me/profiles', { cookie: bo })).json
  assert.deepEqual(
    boProfiles.map((p) => p.studentId),
    ['s2']
  )
  assert.equal((await portal.call('GET', '/api/me/profiles')).status, 401)
})

test('the teacher sees shared fields only: no private notes, birthday without the year', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { ada, bo } = await twoStudents(portal)
  await portal.call('PUT', '/api/me/profiles/s1', {
    cookie: ada,
    body: { bio: 'Hi', dateOfBirth: '2005-12-10', shareBirthday: true, privateNotes: 'secret' }
  })
  await portal.call('PUT', '/api/me/profiles/s2', {
    cookie: bo,
    body: { bio: 'Yo', dateOfBirth: '2006-01-02', shareBirthday: false }
  })
  const profiles = (await portal.sync('/profiles')).json
  const byId = Object.fromEntries(profiles.map((p) => [p.studentId, p]))
  assert.equal(byId.s1.birthday, '12-10')
  assert.equal(byId.s2.birthday, null)
  for (const p of profiles) {
    assert.ok(!('privateNotes' in p))
    assert.ok(!('dateOfBirth' in p))
  }
  assert.ok(!JSON.stringify(profiles).includes('secret'))

  const other = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name: 'Other' }
  })
  assert.deepEqual((await portal.sync('/profiles', undefined, other.json.syncSecret)).json, [])
})

test('profile photos: stored re-encoded, served to the owner and teacher only, replaceable', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { ada, bo } = await twoStudents(portal)
  const upload = (fileName, bytes, cookie = ada) =>
    portal.call('POST', '/api/me/profiles/s1/photo', {
      cookie,
      body: { fileName, fileData: Buffer.from(bytes).toString('base64') }
    })

  const bad = await upload('me.jpg', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]))
  assert.equal(bad.status, 400)
  assert.equal((await upload('me.gif', Buffer.from('GIF89a'))).status, 400)
  assert.equal((await upload('me.jpg', await jpeg(), bo)).status, 404)

  const ok = await upload('me.jpg', await jpeg())
  assert.equal(ok.status, 200)
  assert.equal(ok.json.hasPhoto, true)

  const res = await fetch(`${portal.url}/api/me/profiles/s1/photo`, { headers: { Cookie: ada } })
  assert.equal(res.headers.get('content-type'), 'image/webp')
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
  assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 512, 512])

  const teacherPhoto = await fetch(`${portal.url}/api/sync/profiles/s1/photo`, {
    headers: { 'X-Sync-Secret': portal.secrets.sync }
  })
  assert.equal(teacherPhoto.status, 200)

  // Replacing leaves exactly one file behind; removing leaves none.
  const fs = require('node:fs')
  const dir = require('node:path').join(portal.dataDir, 'profile-photos')
  await upload('me.jpg', await jpeg())
  assert.equal(fs.readdirSync(dir).length, 1)
  const removed = await portal.call('DELETE', '/api/me/profiles/s1/photo', { cookie: ada })
  assert.equal(removed.json.hasPhoto, false)
  assert.equal(fs.readdirSync(dir).length, 0)
})

test('the first-login tour is recorded once per account, on the server', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { ada } = await twoStudents(portal)
  assert.equal((await portal.call('GET', '/api/me', { cookie: ada })).json.onboarded, false)
  assert.equal((await portal.call('POST', '/api/me/onboarding', { cookie: ada })).status, 200)
  assert.equal((await portal.call('GET', '/api/me', { cookie: ada })).json.onboarded, true)
  assert.equal((await portal.call('POST', '/api/me/onboarding')).status, 401)
})
