const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')
const { cleanName, cleanLogo } = require('../services/branding')

// The start of a square PNG: its signature and header, which is all the Portal checks.
function pngOf(side) {
  const bytes = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'latin1')
  bytes.writeUInt32BE(side, 16)
  bytes.writeUInt32BE(side, 20)
  return bytes
}

test('a name is one short line, and only a square PNG is kept as the logo', () => {
  assert.equal(cleanName('  Uni-Helper\n<b>x</b> '), 'Uni-Helper b x /b')
  assert.equal(cleanName('x'.repeat(80)).length, 60)
  assert.equal(cleanName(42), '')
  assert.ok(cleanLogo(pngOf(256).toString('base64')))
  assert.equal(cleanLogo(pngOf(16).toString('base64')), null)
  const wide = pngOf(256)
  wide.writeUInt32BE(128, 20)
  assert.equal(cleanLogo(wide.toString('base64')), null)
  assert.equal(cleanLogo(Buffer.from('<svg onload=alert(1)>').toString('base64')), null)
  assert.equal(cleanLogo('not base64!'), null)
})

test('the Portal takes its name and logo from the teacher’s app', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const before = await portal.call('GET', '/api/branding')
  assert.deepEqual(before.json, { name: '', logo: null })

  const logo = pngOf(256)
  const pub = await portal.sync(
    '',
    classPayload({ extra: { appName: 'Uni-Helper', appLogo: logo.toString('base64') } })
  )
  assert.equal(pub.status, 200)

  const after = (await portal.call('GET', '/api/branding')).json
  assert.equal(after.name, 'Uni-Helper')
  assert.match(after.logo, /^\/api\/branding\/logo\?v=[0-9a-f]+$/)
  const image = await portal.call('GET', after.logo)
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/png')

  const manifest = (await portal.call('GET', '/manifest.json')).json
  assert.equal(manifest.name, 'Uni-Helper')
  assert.deepEqual(manifest.icons, [
    { src: after.logo, sizes: '256x256', type: 'image/png', purpose: 'any' }
  ])

  // Turned off in the app (it sends empty values): EduBoard again.
  await portal.sync('', classPayload({ extra: { appName: '', appLogo: '' } }))
  assert.deepEqual((await portal.call('GET', '/api/branding')).json, { name: '', logo: null })
  assert.equal((await portal.call('GET', '/manifest.json')).json.name, 'EduBoard Portal')
  assert.equal((await portal.call('GET', after.logo)).status, 404)

  // An older app sends neither: what the Portal had stays.
  await portal.sync('', classPayload({ extra: { appName: 'Uni-Helper' } }))
  await portal.sync('', classPayload())
  assert.equal((await portal.call('GET', '/api/branding')).json.name, 'Uni-Helper')
})

test('with several teachers, the name shows only when they agree, or the admin picks one', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const admin = { 'X-Admin-Secret': portal.secrets.admin }
  const second = await portal.call('POST', '/api/admin/teachers', {
    headers: admin,
    body: { name: 'Ms Lee' }
  })
  assert.equal(second.status, 200)
  const leeSecret = second.json.syncSecret
  const name = async () => (await portal.call('GET', '/api/branding')).json.name

  await portal.sync('', classPayload({ extra: { appName: 'Riverside Hub' } }))
  assert.equal(await name(), 'Riverside Hub')
  await portal.sync(
    '',
    classPayload({
      classId: 'c2',
      studentId: 's2',
      invite: 'INV2',
      extra: { appName: 'Lee’s class' }
    }),
    leeSecret
  )
  // They differ, so neither teacher renames the Portal for the other's families.
  assert.equal(await name(), '')

  const view = (await portal.call('GET', '/api/admin/branding', { headers: admin })).json
  assert.equal(view.choice, 'auto')
  const lee = view.teachers.find((x) => x.name === 'Ms Lee')
  assert.equal(lee.appName, 'Lee’s class')
  const chosen = await portal.call('PUT', '/api/admin/branding', {
    headers: admin,
    body: { choice: 'teacher:' + lee.id }
  })
  assert.equal(chosen.status, 200)
  assert.equal(await name(), 'Lee’s class')

  // The same name in both apps (a school pack): shown automatically.
  await portal.call('PUT', '/api/admin/branding', { headers: admin, body: { choice: 'auto' } })
  await portal.sync(
    '',
    classPayload({
      classId: 'c2',
      studentId: 's2',
      invite: 'INV2',
      extra: { appName: 'Riverside Hub' }
    }),
    leeSecret
  )
  assert.equal(await name(), 'Riverside Hub')

  await portal.call('PUT', '/api/admin/branding', { headers: admin, body: { choice: 'eduboard' } })
  assert.equal(await name(), '')

  const bad = await portal.call('PUT', '/api/admin/branding', {
    headers: admin,
    body: { choice: 'teacher:nobody' }
  })
  assert.equal(bad.status, 400)
  assert.equal(bad.json.code, 'PT-6007')
  const noSecret = await portal.call('PUT', '/api/admin/branding', { body: { choice: 'auto' } })
  assert.equal(noSecret.status, 401)
})

test('a family’s calendar is named after the Portal', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, {
    payload: classPayload({ extra: { appName: 'Uni-Helper' } })
  })
  const made = await portal.call('POST', '/api/me/calendar', { cookie, body: { lang: 'en' } })
  const url = new URL(made.json.url)
  const feed = await portal.call('GET', url.pathname + url.search)
  assert.match(feed.text, /X-WR-CALNAME:Uni-Helper homework/)
})
