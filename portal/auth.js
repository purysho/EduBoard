// Auth: passwords are bcrypt-hashed (accounts.password_hash). Sessions are stateless,
// signed cookies (HMAC-SHA256 over accountId+expiry with SESSION_SECRET) — no server-side
// session table to manage, at the cost of not being able to force-expire one cookie early;
// acceptable for this app's size (see portal/README.md). QR "quick login" tokens are a
// second, independent credential: a random token whose hash is stored (never the raw
// value), so a leaked database dump doesn't hand out working QR logins any more than it
// hands out working passwords.
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const SESSION_SECRET = process.env.SESSION_SECRET
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET env var is required — see portal/README.md')
}
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash)
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

function issueSessionCookie(res, accountId) {
  const token = sign({ accountId, exp: Date.now() + SESSION_TTL_MS })
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
  req.accountId = payload.accountId
  next()
}

// The teacher-only push/pull endpoints use a single shared secret (SYNC_SECRET), not a
// per-teacher account system — this portal is a single-teacher deployment, not a SaaS
// serving many teachers, matching the "not a large database" brief it was scoped to.
function requireSyncSecret(req, res, next) {
  const secret = req.get('X-Sync-Secret')
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Bad sync secret' })
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
  issueSessionCookie,
  requireAuth,
  requireSyncSecret,
  newRandomToken,
  hashToken
}
