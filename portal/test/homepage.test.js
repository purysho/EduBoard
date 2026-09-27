const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { startPortal } = require('./helpers')

// fetch() can't set a Host header, so ask with a plain request.
function get(url, host) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    http
      .get(
        { hostname: u.hostname, port: u.port, path: u.pathname, headers: { Host: host } },
        (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => resolve({ status: res.statusCode, body }))
        }
      )
      .on('error', reject)
  })
}

test('the homepage is at /download, and is the front page only for HOMEPAGE_HOSTS', async (t) => {
  const portal = await startPortal({ HOMEPAGE_HOSTS: 'edu-board.com, www.edu-board.com' })
  t.after(portal.stop)

  const dl = await get(portal.url + '/download', 'portal.example')
  assert.equal(dl.status, 200)
  assert.match(dl.body, /Download EduBoard/)
  assert.match(dl.body, /\/api\/app-release/)
  // No outside resources: fonts or scripts from elsewhere are blocked or slow in China.
  assert.doesNotMatch(dl.body, /<(script|link)[^>]+(src|href)="https?:\/\//)

  const front = await get(portal.url + '/', 'EDU-board.com')
  assert.match(front.body, /<title>EduBoard: the teacher’s desk/)
  const portalFront = await get(portal.url + '/', 'portal.example')
  assert.match(portalFront.body, /<title>EduBoard Portal<\/title>/) // still the student login
})
