const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PORTAL_ERROR_CODES } = require('../errorCodes')
const { startPortal } = require('./helpers')

const ROOT = path.join(__dirname, '..')
const SOURCES = ['server.js', 'auth.js', 'rateLimit.js', 'services/mailer.js']
  .concat(fs.readdirSync(path.join(ROOT, 'routes')).map((f) => `routes/${f}`))
  .filter((f) => f.endsWith('.js'))

/** Every res.json({...}) body in a file that has an `error:` key, found by counting braces. */
function errorBodies(text) {
  const out = []
  let at = 0
  while ((at = text.indexOf('.json({', at)) !== -1) {
    let depth = 0
    let i = at + 6
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}' && --depth === 0) break
    }
    const body = text.slice(at + 6, i + 1)
    if (/\berror:/.test(body)) out.push(body)
    at = i
  }
  return out
}

test('every Portal error answer has a code from the catalog, and every code is used', () => {
  const used = new Set()
  const missing = []
  for (const file of SOURCES) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const body of errorBodies(text)) {
      if (!/\bcode:/.test(body)) missing.push(`${file}: ${body.replace(/\s+/g, ' ').slice(0, 80)}`)
    }
    for (const m of text.matchAll(/'(PT-\d{4})'/g)) used.add(m[1])
  }
  assert.deepEqual(missing, [])
  assert.deepEqual(
    [...used].filter((c) => !(c in PORTAL_ERROR_CODES)),
    []
  )
  assert.deepEqual(
    Object.keys(PORTAL_ERROR_CODES).filter((c) => !used.has(c)),
    []
  )
})

test('a wrong password answers with its code', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const res = await portal.call('POST', '/api/auth/login', {
    body: { username: 'nobody', password: 'wrong-password' }
  })
  assert.equal(res.status, 401)
  assert.equal(res.json.code, 'PT-1002')
})
