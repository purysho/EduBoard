const express = require('express')
const db = require('../db')
const crypto = require('crypto')
const {
  verifyPassword,
  issueSessionCookie,
  hashToken,
  hashPassword,
  passwordProblem,
  revokeSessions,
  newRandomToken
} = require('../auth')
const { RateLimiter, rateLimit, tooMany, LIMITS } = require('../rateLimit')

const router = express.Router()

const loginPerIp = rateLimit(LIMITS.loginPerIp)
// Keyed by the username being attempted, not by who's asking: a slow guess at one
// account spread across many IPs still hits this. Only failures count, and a correct
// password is refused while locked, so the lock can't be sidestepped by getting lucky.
const loginFailures = new RateLimiter(LIMITS.loginFailuresPerUser)
const secretUrlPerIp = rateLimit(LIMITS.secretUrlPerIp)

router.post('/login', loginPerIp, (req, res) => {
  const { username, password } = req.body
  const userKey = String(username || '').toLowerCase()
  if (loginFailures.isBlocked(userKey)) {
    return tooMany(
      res,
      loginFailures.retryAfterSec(userKey),
      'Too many failed attempts for this account. Wait a few minutes, or ask your teacher to reset your password.'
    )
  }

  const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username || '')
  // Runs bcrypt even when the account doesn't exist, so timing doesn't reveal usernames.
  if (!verifyPassword(password || '', account?.password_hash)) {
    loginFailures.consume(userKey)
    return res.status(401).json({ error: 'Wrong username or password' })
  }
  loginFailures.reset(userKey)
  issueSessionCookie(res, account.id)
  res.json({ ok: true })
})

// Scanning/opening the saved QR image hits this with its embedded token as a query
// param, so it can be a plain link (no form to fill in) — see routes/me.js for how the
// token is issued as a downloadable image in the first place.
router.get('/qr-login', secretUrlPerIp, (req, res) => {
  const token = req.query.token
  if (!token || typeof token !== 'string') return res.status(400).send('Missing token')

  const row = db
    .prepare('SELECT * FROM qr_tokens WHERE token_hash = ? AND revoked = 0')
    .get(hashToken(token))
  if (!row)
    return res.status(401).send('This QR code is no longer valid — ask your teacher for a new one.')

  issueSessionCookie(res, row.account_id)
  res.redirect('/')
})

router.post('/logout', (_req, res) => {
  res.clearCookie('eduboard_session')
  res.json({ ok: true })
})

// ---- Forgot password: ask, the teacher approves, then choose a new one ----------------------
// Nobody is told whether a username exists: an unknown one gets a request that simply
// never gets approved. Requests last a day.
const RESET_TTL_MS = 24 * 60 * 60 * 1000
const resetRequestPerIp = rateLimit(LIMITS.resetRequestPerIp)

function findResetRequest(id, secret) {
  const row = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(String(id))
  if (!row || typeof secret !== 'string' || row.secret_hash !== hashToken(secret)) return null
  if (Date.now() - Date.parse(row.requested_at) > RESET_TTL_MS && row.status !== 'used') {
    return { ...row, status: 'expired' }
  }
  return row
}

router.post('/reset-request', resetRequestPerIp, (req, res) => {
  const username = String(req.body?.username || '').trim()
  if (!username) return res.status(400).json({ error: 'Enter your username' })
  const account = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username)
  if (account) {
    // One open request per account: asking again replaces the old one.
    db.prepare(
      "DELETE FROM password_reset_requests WHERE account_id = ? AND status = 'pending'"
    ).run(account.id)
  }
  const id = crypto.randomUUID()
  const secret = newRandomToken()
  db.prepare(
    `INSERT INTO password_reset_requests (id, account_id, secret_hash, status, requested_at)
     VALUES (?, ?, ?, 'pending', ?)`
  ).run(id, account ? account.id : null, hashToken(secret), new Date().toISOString())
  res.json({ ok: true, id, secret })
})

router.post('/reset-request/:id/status', secretUrlPerIp, (req, res) => {
  const row = findResetRequest(req.params.id, req.body?.secret)
  if (!row) return res.status(404).json({ error: 'Request not found' })
  res.json({ status: row.status })
})

router.post('/reset-request/:id/complete', secretUrlPerIp, (req, res) => {
  const row = findResetRequest(req.params.id, req.body?.secret)
  if (!row || row.status !== 'approved' || !row.account_id) {
    return res.status(403).json({ error: 'This reset hasn’t been approved by your teacher.' })
  }
  const newPassword = req.body?.newPassword
  const problem = passwordProblem(newPassword)
  if (problem) return res.status(400).json({ error: problem })
  db.transaction(() => {
    db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(
      hashPassword(newPassword),
      row.account_id
    )
    db.prepare("UPDATE password_reset_requests SET status = 'used' WHERE id = ?").run(row.id)
  })()
  // Anyone still signed in with the old password is signed out; this browser is signed in.
  revokeSessions(row.account_id)
  loginFailures.reset(
    String(
      db.prepare('SELECT username FROM accounts WHERE id = ?').get(row.account_id).username
    ).toLowerCase()
  )
  issueSessionCookie(res, row.account_id)
  res.json({ ok: true })
})

module.exports = router
