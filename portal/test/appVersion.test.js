const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal } = require('./helpers')

test('the Portal tells the desktop app which version is newest, without a login', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const res = await portal.call('GET', '/api/app-version')
  assert.equal(res.status, 200)
  assert.equal(res.json.version, require('../desktop-version.json').version)
  assert.match(res.json.downloadUrl, /^https:\/\/github\.com\/purysho\/EduBoard\/releases/)
})
