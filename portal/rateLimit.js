// In-memory fixed-window rate limiting. Deliberately no Redis/external store: the Portal
// is one Node process on one small VPS, so process memory *is* the shared state, and a
// restart resetting the counters is an acceptable (brief) loosening, not a hole.
// If the Portal is ever run as several processes, this is the one file to swap for a
// shared store.

class RateLimiter {
  /**
   * @param {{ windowMs: number, max: number, now?: () => number }} opts
   */
  constructor({ windowMs, max, now = Date.now }) {
    this.windowMs = windowMs
    this.max = max
    this.now = now
    this.hits = new Map() // key -> { count, resetAt }
  }

  /** Records one hit for `key` and reports whether it's still within the limit. */
  consume(key) {
    const t = this.now()
    let entry = this.hits.get(key)
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs }
      this.hits.set(key, entry)
    }
    entry.count++
    this.sweep(t)
    return {
      allowed: entry.count <= this.max,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000))
    }
  }

  /** True once `key` has used up its window, without recording a hit. */
  isBlocked(key) {
    const entry = this.hits.get(key)
    return !!entry && entry.resetAt > this.now() && entry.count >= this.max
  }

  retryAfterSec(key) {
    const entry = this.hits.get(key)
    return entry ? Math.max(1, Math.ceil((entry.resetAt - this.now()) / 1000)) : 1
  }

  reset(key) {
    this.hits.delete(key)
  }

  // Expired entries are dropped opportunistically (at most once per window) so a flood
  // of distinct keys — e.g. a scan across many IPs — can't grow the map without bound.
  sweep(t) {
    if (this.lastSweep && t - this.lastSweep < this.windowMs) return
    this.lastSweep = t
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= t) this.hits.delete(key)
    }
  }
}

function tooMany(res, retryAfterSec, message) {
  res.set('Retry-After', String(retryAfterSec))
  return res
    .status(429)
    .json({ error: message || 'Too many attempts. Please wait a few minutes and try again.' })
}

/** Express middleware that counts every request under `keyFn(req)`. */
function rateLimit({ windowMs, max, keyFn = (req) => req.ip, message }) {
  const limiter = new RateLimiter({ windowMs, max })
  const middleware = (req, res, next) => {
    const { allowed, retryAfterSec } = limiter.consume(keyFn(req))
    if (!allowed) return tooMany(res, retryAfterSec, message)
    next()
  }
  middleware.limiter = limiter
  middleware.message = message
  return middleware
}

function envInt(name, fallback) {
  const n = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MINUTE = 60 * 1000

// Every limit in one place, each overridable by env var for a school with unusual needs
// (e.g. a whole lab of students behind one NAT'd IP logging in at once).
const LIMITS = {
  // Per client IP, across every account — the brute-force / credential-stuffing guard.
  loginPerIp: { windowMs: 15 * MINUTE, max: envInt('RATE_LOGIN_PER_IP', 50) },
  // Failed logins per username — stops a slow, distributed guess at one account.
  loginFailuresPerUser: { windowMs: 15 * MINUTE, max: envInt('RATE_LOGIN_FAILS_PER_USER', 10) },
  // Invite lookups/redemptions and QR logins are both "guess a secret in the URL".
  secretUrlPerIp: { windowMs: 15 * MINUTE, max: envInt('RATE_SECRET_URL_PER_IP', 60) },
  // Bad sync/admin secrets per IP. Only failures count, so a teacher's own heavy
  // publishing is never throttled.
  badSecretPerIp: { windowMs: 15 * MINUTE, max: envInt('RATE_BAD_SECRET_PER_IP', 20) },
  // AI calls spend the teacher's own API key: a burst limit plus a daily budget per
  // family account (chat + translation together).
  aiPerAccountBurst: { windowMs: MINUTE, max: envInt('RATE_AI_PER_MINUTE', 6) },
  aiPerAccountDaily: { windowMs: 24 * 60 * MINUTE, max: envInt('RATE_AI_PER_DAY', 100) },
  // Password changes (needs the current password, so it's another guessing oracle).
  passwordChangePerAccount: { windowMs: 15 * MINUTE, max: envInt('RATE_PASSWORD_CHANGE', 5) }
}

module.exports = { RateLimiter, rateLimit, tooMany, LIMITS }
