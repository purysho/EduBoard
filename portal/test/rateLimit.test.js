const test = require('node:test')
const assert = require('node:assert/strict')
const { RateLimiter } = require('../rateLimit')

test('allows up to max hits per window, then blocks until the window resets', () => {
  let now = 0
  const limiter = new RateLimiter({ windowMs: 1000, max: 3, now: () => now })
  assert.equal(limiter.consume('a').allowed, true)
  assert.equal(limiter.consume('a').allowed, true)
  assert.equal(limiter.consume('a').allowed, true)
  const blocked = limiter.consume('a')
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSec, 1)
  assert.equal(limiter.isBlocked('a'), true)

  now = 1000
  assert.equal(limiter.isBlocked('a'), false)
  assert.equal(limiter.consume('a').allowed, true)
})

test('keys are independent, and reset() clears one key', () => {
  let now = 0
  const limiter = new RateLimiter({ windowMs: 1000, max: 1, now: () => now })
  limiter.consume('a')
  assert.equal(limiter.isBlocked('a'), true)
  assert.equal(limiter.isBlocked('b'), false)
  limiter.reset('a')
  assert.equal(limiter.isBlocked('a'), false)
})

test('expired keys are swept so memory does not grow without bound', () => {
  let now = 0
  const limiter = new RateLimiter({ windowMs: 1000, max: 5, now: () => now })
  for (let i = 0; i < 100; i++) limiter.consume(`ip-${i}`)
  now = 5000
  limiter.consume('fresh')
  assert.equal(limiter.hits.size, 1)
})
