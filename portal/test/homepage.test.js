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

test('the homepage’s Log in link reaches the Portal login from either address', async (t) => {
  const portal = await startPortal({
    HOMEPAGE_HOSTS: 'edu-board.com',
    PORTAL_HOST: 'portal.edu-board.com'
  })
  t.after(portal.stop)
  const home = await get(portal.url + '/', 'edu-board.com')
  assert.match(home.body, /href="\/login"/)
  // On the homepage's own address, it goes to the Portal's address…
  const fromHome = await getHead(portal.url + '/login', 'edu-board.com')
  assert.equal(fromHome.status, 302)
  assert.equal(fromHome.location, 'https://portal.edu-board.com/')
  // …and on the Portal's address it's just the front page.
  const fromPortal = await getHead(portal.url + '/login', 'portal.edu-board.com')
  assert.equal(fromPortal.location, '/')
  // The login page asks search engines to leave it out; the homepage doesn't.
  assert.match(
    (await get(portal.url + '/', 'portal.edu-board.com')).body,
    /name="robots" content="noindex"/
  )
  assert.doesNotMatch(home.body, /noindex/)
})

test('without PORTAL_HOST, Log in on the homepage address shows the login there', async (t) => {
  const portal = await startPortal({ HOMEPAGE_HOSTS: 'edu-board.com' })
  t.after(portal.stop)
  const page = await get(portal.url + '/login', 'edu-board.com')
  assert.equal(page.status, 200)
  assert.match(page.body, /<title>EduBoard Portal<\/title>/)
})

function getHead(url, host) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    http
      .get(
        { hostname: u.hostname, port: u.port, path: u.pathname, headers: { Host: host } },
        (res) => {
          res.resume()
          resolve({ status: res.statusCode, location: res.headers.location })
        }
      )
      .on('error', reject)
  })
}

test('the privacy notice and data processing terms are served in both languages', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  for (const [route, en, zh] of [
    ['/privacy', /<h1>Privacy notice<\/h1>/, /<h1>隐私说明<\/h1>/],
    ['/data-processing', /<h1>Data processing terms<\/h1>/, /<h1>数据处理条款<\/h1>/],
    ['/security', /<h1>Security overview<\/h1>/, /<h1>安全概述<\/h1>/],
    ['/terms', /<h1>Terms of use<\/h1>/, /<h1>使用条款<\/h1>/],
    ['/brochure', /<h1>Teachers keep their records/, /<h1>记录留在老师手里/]
  ]) {
    const page = await get(portal.url + route, 'edu-board.com')
    assert.equal(page.status, 200, route)
    assert.match(page.body, en)
    assert.match(page.body, zh)
    assert.doesNotMatch(page.body, /<(script|link)[^>]+(src|href)="https?:\/\//)
  }
  const home = await get(portal.url + '/download', 'edu-board.com')
  assert.match(home.body, /href="\/privacy"/)
  assert.match(home.body, /href="\/data-processing"/)
})

test('security.txt names a contact and the security page', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const txt = await get(portal.url + '/.well-known/security.txt', 'edu-board.com')
  assert.equal(txt.status, 200)
  assert.match(txt.body, /^Contact: mailto:privacy@edu-board\.com$/m)
  assert.match(txt.body, /^Expires: \d{4}-/m)
  assert.match(txt.body, /^Policy: https:\/\/edu-board\.com\/security$/m)
})
