const test = require('node:test')
const assert = require('node:assert/strict')
const { checkUpload } = require('../services/fileSafety')
// Same cases as the desktop copy, so the two can't disagree about a file.
const { cases } = require('../../src/shared/__tests__/fileSafetyCases.json')

for (const c of cases) {
  test(`${c.ok ? 'accepts' : 'rejects'} ${c.name}`, () => {
    const result = checkUpload(c.fileName, Buffer.from(c.base64, 'base64'))
    assert.equal(result.ok, c.ok, result.reason)
  })
}
