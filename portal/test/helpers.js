// Spawns a real Portal process on a throwaway data directory, so tests exercise the
// actual Express stack, SQLite schema and rate limiters rather than mocks of them.
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Built at runtime, never written out literally, so no scanner mistakes a fixture for a
// leaked credential.
const randomSecret = () => crypto.randomBytes(24).toString('hex')

async function startPortal(extraEnv = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eduboard-portal-test-'))
  const secrets = { session: randomSecret(), sync: randomSecret(), admin: randomSecret() }
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      // Port 0: the Portal takes a free port itself and prints it. Picking a "free" port
      // here and passing it in raced with the other test files running in parallel: one
      // could take the port first, and this test then talked to the wrong Portal.
      PORT: '0',
      HOST: '127.0.0.1',
      PORTAL_DATA_DIR: dataDir,
      SESSION_SECRET: secrets.session,
      SYNC_SECRET: secrets.sync,
      ADMIN_SECRET: secrets.admin,
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))

  let port = null
  for (let i = 0; i < 200 && !port; i++) {
    port = /listening on [^\n]*:(\d+)/.exec(output)?.[1] ?? null
    if (!port && child.exitCode !== null) {
      fs.rmSync(dataDir, { recursive: true, force: true })
      throw new Error(`Portal exited early:\n${output}`)
    }
    if (!port) await new Promise((r) => setTimeout(r, 25))
  }
  if (!port) {
    child.kill()
    fs.rmSync(dataDir, { recursive: true, force: true })
    throw new Error(`Portal didn't start:\n${output}`)
  }
  const url = `http://127.0.0.1:${port}`

  const call = async (method, p, { body, headers = {}, cookie } = {}) => {
    const res = await fetch(url + p, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      // non-JSON body (e.g. a redirect)
    }
    const setCookie = res.headers.get('set-cookie')
    return {
      status: res.status,
      json,
      text,
      headers: res.headers,
      cookie: setCookie ? setCookie.split(';')[0] : null
    }
  }

  const sync = (p, body, secret = secrets.sync) =>
    call(body === undefined ? 'GET' : 'POST', '/api/sync' + p, {
      body,
      headers: { 'X-Sync-Secret': secret }
    })

  const stop = () =>
    new Promise((resolve) => {
      child.once('exit', () => {
        fs.rmSync(dataDir, { recursive: true, force: true })
        resolve()
      })
      child.kill()
    })

  return { url, call, sync, secrets, dataDir, stop, output: () => output }
}

/** A minimal one-class, one-student publish payload, plus a redeemable invite. */
function classPayload({ classId = 'c1', studentId = 's1', invite = 'INV1', extra = {} } = {}) {
  return {
    classes: [{ id: classId, name: 'Biology 101', levelType: 'university' }],
    students: [{ id: studentId, firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: null }],
    enrollments: [{ studentId, classId, status: 'active' }],
    grades: [{ studentId, classId, percent: 91, letter: 'A', attendanceRate: 0.95 }],
    invites: [{ code: invite, classId, revoked: false }],
    ...extra
  }
}

/** Publishes a class and redeems its invite, returning the new account's session cookie. */
async function makeStudentAccount(portal, { username = 'ada', password, payload } = {}) {
  const pw = password || randomSecret()
  const pub = await portal.sync('', payload || classPayload())
  if (pub.status !== 200) throw new Error(`publish failed: ${pub.text}`)
  const res = await portal.call('POST', '/api/invites/INV1/redeem', {
    body: { studentId: 's1', username, password: pw }
  })
  if (res.status !== 200) throw new Error(`redeem failed: ${res.text}`)
  return { cookie: res.cookie, username, password: pw }
}

module.exports = { startPortal, classPayload, makeStudentAccount, randomSecret }
