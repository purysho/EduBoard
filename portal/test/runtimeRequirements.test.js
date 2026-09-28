const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const portalRoot = path.join(__dirname, '..')

test('Portal declares Node 22 as its minimum runtime', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(portalRoot, 'package.json'), 'utf8'))
  assert.equal(pkg.engines.node, '>=22')
})

test('server updater can repair an older Node runtime before npm ci', () => {
  const script = fs.readFileSync(path.join(portalRoot, 'scripts', 'update-server.sh'), 'utf8')
  assert.match(script, /node_22\.x/)
  assert.match(script, /ensure_node_22/)
  assert.match(script, /build-essential/)
  assert.ok(script.indexOf('ensure_node_22') < script.indexOf('npm ci'))
})
