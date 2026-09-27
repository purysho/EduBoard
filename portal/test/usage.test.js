const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { startPortal } = require('./helpers')

const ping = (overrides = {}) => ({
  id: crypto.randomUUID(),
  version: '0.4.0',
  os: 'windows',
  language: 'zh',
  classes: '3-5',
  students: '31-100',
  portal: true,
  ...overrides
})

test('usage pings are counted once per install per week, and only in the agreed shape', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const send = (body) => portal.call('POST', '/api/usage/ping', { body })

  const a = ping()
  assert.equal((await send(a)).status, 200)
  assert.equal((await send(a)).status, 200) // again this week: still one
  assert.equal((await send(ping({ os: 'mac', language: 'en' }))).status, 200)

  // Anything beyond the fixed fields, or outside them, is refused.
  assert.equal((await send(ping({ id: 'not-a-uuid' }))).status, 400)
  assert.equal((await send(ping({ classes: '12' }))).status, 400)
  assert.equal((await send(ping({ os: 'Ada Lovelace' }))).status, 400)
  assert.equal((await send({})).status, 400)

  const denied = await portal.call('GET', '/api/admin/usage')
  assert.equal(denied.status, 401)
  const summary = await portal.call('GET', '/api/admin/usage?weeks=4', {
    headers: { 'X-Admin-Secret': portal.secrets.admin }
  })
  assert.equal(summary.status, 200)
  const week = summary.json.weeks.at(-1)
  assert.equal(summary.json.weeks.length, 4)
  assert.equal(week.active, 2)
  assert.equal(week.new, 2)
  assert.equal(week.week4, null) // not four weeks on yet
  assert.equal(
    summary.json.thisWeek.reduce((n, r) => n + r.n, 0),
    2
  )
})

test('weeks start on Monday', () => {
  const { weekOf } = require('../routes/usage')
  assert.equal(weekOf(new Date('2026-09-27T12:00:00Z')), '2026-09-21') // a Sunday
  assert.equal(weekOf(new Date('2026-09-28T00:00:00Z')), '2026-09-28') // a Monday
})
