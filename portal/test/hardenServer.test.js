// harden-server.sh's "start"/"wait": turning the firewall on can cut the SSH session that
// started the lock-down, so the run must carry on without it and be picked up again after
// reconnecting. Runs the real script with only the hardening itself replaced by a short
// stand-in (and its log in a temporary folder).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const SCRIPT = path.join(__dirname, '..', 'scripts', 'harden-server.sh')

function patchedScript(dir, exitCode) {
  const script = fs
    .readFileSync(SCRIPT, 'utf8')
    .replace('[ "$(id -u)" = 0 ] || fail "Run this as root."', ':')
    .replace('LOG=/var/log/eduboard-harden.log', `LOG=${dir}/harden.log`)
    .replace('LOCK=/run/eduboard-harden.lock', `LOCK=${dir}/harden.lock`)
    .replace('command -v systemd-run >/dev/null', 'false')
    .replace(
      'bash "$0" harden >>"$LOG" 2>&1',
      `bash -c 'for i in 1 2 3 4; do echo "step $i"; sleep 0.5; done; exit ${exitCode}' >>"$LOG" 2>&1`
    )
  assert.ok(!script.includes('bash "$0" harden >>'), 'the stand-in replaced the real run')
  const file = path.join(dir, 'harden.sh')
  fs.writeFileSync(file, script)
  return file
}

const run = (file, ...args) => spawnSync('bash', [file, ...args], { encoding: 'utf8' })

test('a lock-down carries on when the SSH session is cut, and "wait" shows how it ended', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eduboard-harden-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = patchedScript(dir, 3)

  // The session that starts it is cut after a second, mid-run.
  const session = spawn('bash', [file, 'start', '111'])
  await new Promise((r) => setTimeout(r, 1000))
  session.kill('SIGKILL')

  const after = run(file, 'wait', '111')
  assert.equal(after.status, 3, 'the run finished on its own and its result comes back')
  assert.match(after.stdout, /step 1[\s\S]*step 4/)

  // A different run number never shows this run as if it were that one.
  const other = run(file, 'wait', '222')
  assert.equal(other.status, 1)
  assert.match(other.stderr, /dropped before the lock-down started/)
})

test('a lock-down run straight through ends with its own result', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eduboard-harden-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const result = run(patchedScript(dir, 0), 'start', '7')
  assert.equal(result.status, 0)
  assert.match(result.stdout, /step 4/)
  assert.doesNotMatch(result.stdout, /EDUBOARD-HARDEN-EXIT/)
})
