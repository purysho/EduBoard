// Auth: passwords are bcrypt-hashed (accounts.password_hash). Sessions are stateless,
// signed cookies (HMAC-SHA256 over accountId+expiry with SESSION_SECRET) — no server-side
// session table to manage, at the cost of not being able to force-expire one cookie early;
// acceptable for this app's size (see portal/README.md). QR "quick login" tokens are a
// second, independent credential: a random token whose hash is stored (never the raw
// value), so a leaked database dump doesn't hand out working QR logins any more than it
// hands out working passwords.
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { RateLimiter, tooMany, LIMITS } = require('./rateLimit')

const SESSION_SECRET = process.env.SESSION_SECRET
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET env var is required — see portal/README.md')
}
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

// Compared against when a username doesn't exist, so "no such user" costs the same
// bcrypt time as "wrong password" and response timing doesn't reveal which usernames exist.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10)

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash || DUMMY_HASH) && !!hash
}

// bcrypt only reads the first 72 bytes, so a longer password would silently match any
// other password sharing that prefix — reject it instead of truncating behind the user's back.
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72

/** Returns an error message for an unacceptable new password, or null if it's fine. */
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return 'Password is too long (72 bytes max)'
  }
  return null
}

/** Constant-time string equality — hashing first makes both sides the same length, so
 * timingSafeEqual never throws and the comparison time never depends on the input. */
function secretsEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verify(token) {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
  if (payload.exp < Date.now()) return null
  return payload
}

// Sessions are stateless signed cookies, so they can't be deleted server-side. Instead
// each cookie carries the account's session_version, and bumping that column (password
// change, teacher-triggered reset) invalidates every cookie issued before it.
function issueSessionCookie(res, accountId) {
  const db = require('./db')
  const row = db.prepare('SELECT session_version FROM accounts WHERE id = ?').get(accountId)
  const token = sign({ accountId, sv: row?.session_version ?? 0, exp: Date.now() + SESSION_TTL_MS })
  res.cookie('eduboard_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS
  })
}

function requireAuth(req, res, next) {
  const payload = verify(req.cookies?.eduboard_session)
  if (!payload) return res.status(401).json({ error: 'Not logged in' })
  const db = require('./db')
  const account = db
    .prepare('SELECT session_version FROM accounts WHERE id = ?')
    .get(payload.accountId)
  if (!account || account.session_version !== (payload.sv ?? 0)) {
    res.clearCookie('eduboard_session')
    return res.status(401).json({ error: 'Not logged in' })
  }
  req.accountId = payload.accountId
  next()
}

/** Signs out every existing session for this account (see issueSessionCookie) and
 * cancels its quick-login QR codes. Those are a second credential, and a password change
 * or reset is exactly when an old one might be in the wrong hands. */
function revokeSessions(accountId) {
  const db = require('./db')
  db.transaction(() => {
    db.prepare('UPDATE accounts SET session_version = session_version + 1 WHERE id = ?').run(
      accountId
    )
    db.prepare('UPDATE qr_tokens SET revoked = 1 WHERE account_id = ?').run(accountId)
  })()
}

// Only *failed* secret checks count, per client IP: a guesser is cut off quickly while a
// teacher publishing all day with the right secret is never throttled.
const badSecretLimiter = new RateLimiter(LIMITS.badSecretPerIp)

// Every teacher using this Portal has their own sync secret (see teachers table) —
// looked up by its hash, never compared as plaintext, same principle as QR tokens.
// Everything downstream (routes/sync.js, routes/me.js) scopes its queries by
// req.teacherId, which is what makes this Portal safe to run for a whole school's
// staff rather than just one teacher.
function requireSyncSecret(req, res, next) {
  if (badSecretLimiter.isBlocked(req.ip)) {
    return tooMany(res, badSecretLimiter.retryAfterSec(req.ip))
  }
  const secret = req.get('X-Sync-Secret')
  const db = require('./db')
  const teacher = secret
    ? db.prepare('SELECT id FROM teachers WHERE sync_secret_hash = ?').get(hashToken(secret))
    : null
  if (!teacher) {
    badSecretLimiter.consume(req.ip)
    return res.status(401).json({ error: 'Bad sync secret' })
  }
  req.teacherId = teacher.id
  next()
}

// Gates the teacher-management endpoints (routes/admin.js) — a separate, higher-value
// secret than any individual teacher's sync secret, held by whoever administers the
// Portal (the school, or the first teacher who set it up), since it can mint new
// teacher accounts.
function requireAdminSecret(req, res, next) {
  if (badSecretLimiter.isBlocked(req.ip)) {
    return tooMany(res, badSecretLimiter.retryAfterSec(req.ip))
  }
  const secret = req.get('X-Admin-Secret')
  const expected = process.env.ADMIN_SECRET
  if (!expected || !secret || !secretsEqual(secret, expected)) {
    badSecretLimiter.consume(req.ip)
    return res.status(401).json({ error: 'Bad admin secret' })
  }
  next()
}

function newRandomToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

module.exports = {
  hashPassword,
  verifyPassword,
  passwordProblem,
  secretsEqual,
  revokeSessions,
  issueSessionCookie,
  requireAuth,
  requireSyncSecret,
  requireAdminSecret,
  newRandomToken,
  hashToken
}
