const express = require('express')
const db = require('../db')
const { verifyPassword, issueSessionCookie, hashToken } = require('../auth')

const router = express.Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username || '')
  if (!account || !verifyPassword(password || '', account.password_hash)) {
    return res.status(401).json({ error: 'Wrong username or password' })
  }
  issueSessionCookie(res, account.id)
  res.json({ ok: true })
})

// Scanning/opening the saved QR image hits this with its embedded token as a query
// param, so it can be a plain link (no form to fill in) — see routes/me.js for how the
// token is issued as a downloadable image in the first place.
router.get('/qr-login', (req, res) => {
  const token = req.query.token
  if (!token) return res.status(400).send('Missing token')

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
