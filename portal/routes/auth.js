const express = require('express')
const db = require('../db')
const { verifyPassword, issueSessionCookie, hashToken } = require('../auth')
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
  if (!row) return res.status(401).send('This QR code is no longer valid — ask your teacher for a new one.')

  issueSessionCookie(res, row.account_id)
  res.redirect('/')
})

router.post('/logout', (_req, res) => {
  res.clearCookie('eduboard_session')
  res.json({ ok: true })
})

module.exports = router
