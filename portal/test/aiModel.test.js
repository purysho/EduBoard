const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

test('the Study Helper uses the teacher’s chosen model, or the provider’s default', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eduboard-ai-model-'))
  process.env.PORTAL_DATA_DIR = dir
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const db = require('../db')
  const { saveAiSettings, targetFor } = require('../services/ai')
  db.prepare(
    "INSERT INTO teachers (id, name, sync_secret_hash, created_at) VALUES ('t1', 'T', 'h', 'now')"
  ).run()

  saveAiSettings('t1', { provider: 'zhipu', apiKey: 'k', helperModel: ' glm-4.7-flash ' })
  assert.equal(targetFor('t1').model, 'glm-4.7-flash')
  saveAiSettings('t1', { provider: 'zhipu', apiKey: 'k', helperModel: '' })
  assert.equal(targetFor('t1').model, 'glm-4-flash-250414')
  saveAiSettings('t1', { provider: 'zhipu', apiKey: '' })
  assert.throws(() => targetFor('t1'), /set up AI/)
})
