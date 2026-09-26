const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { startPortal } = require('./helpers')

/** Stands in for GitHub: the release list and one download. */
async function fakeGitHub(t) {
  const file = Buffer.from('new EduBoard')
  const server = http.createServer((req, res) => {
    if (req.url === '/release') {
      const base = `http://127.0.0.1:${server.address().port}`
      res.setHeader('Content-Type', 'application/json')
      return res.end(
        JSON.stringify({
          tag_name: 'v9.9.9',
          assets: [
            { name: 'EduBoard-Setup.exe', size: file.length, browser_download_url: `${base}/dl` },
            { name: 'latest.yml', size: 10, browser_download_url: `${base}/yml` }
          ]
        })
      )
    }
    if (req.url === '/dl') return res.end(file)
    res.statusCode = 404
    res.end()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  return { url: `http://127.0.0.1:${server.address().port}/release`, file }
}

test('the Portal relays the newest desktop release and its downloads', async (t) => {
  const github = await fakeGitHub(t)
  const portal = await startPortal({ APP_RELEASE_API: github.url })
  t.after(portal.stop)

  const release = await portal.call('GET', '/api/app-release')
  assert.equal(release.status, 200)
  // Only files an update uses are listed.
  assert.deepEqual(release.json, {
    version: '9.9.9',
    assets: [{ name: 'EduBoard-Setup.exe', size: github.file.length }]
  })
  const version = await portal.call('GET', '/api/app-version')
  assert.equal(version.json.version, '9.9.9')

  const dl = await fetch(`${portal.url}/api/app-release/download/EduBoard-Setup.exe`)
  assert.equal(dl.status, 200)
  assert.equal(Buffer.from(await dl.arrayBuffer()).toString(), 'new EduBoard')
  assert.equal((await portal.call('GET', '/api/app-release/download/latest.yml')).status, 404)
})

test('without GitHub, the version notice falls back to the version this Portal was built with', async (t) => {
  const portal = await startPortal({ APP_RELEASE_API: 'http://127.0.0.1:9/nowhere' })
  t.after(portal.stop)
  const res = await portal.call('GET', '/api/app-version')
  assert.equal(res.status, 200)
  assert.equal(res.json.version, require('../desktop-version.json').version)
  assert.equal((await portal.call('GET', '/api/app-release')).status, 502)
})
