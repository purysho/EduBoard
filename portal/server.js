const path = require('path')
const express = require('express')
const cookieParser = require('cookie-parser')

const app = express()
app.disable('x-powered-by')

// The README deploys this behind Caddy on the same machine, so the client's real IP is
// in X-Forwarded-For. Trust that header only from loopback by default. Trusting it from
// anywhere would let any client spoof its IP and dodge every per-IP rate limit. Set
// TRUST_PROXY (an Express "trust proxy" value) for a different topology.
function parseTrustProxy(value) {
  if (!value) return 'loopback'
  if (value === 'true' || value === 'false') return value === 'true'
  if (/^\d+$/.test(value)) return Number(value) // number of proxy hops
  return value // IPs/subnets or names like "loopback, uniquelocal"
}
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY))

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // QR-login and invite links carry secrets in the URL; never leak them via Referer.
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin'
  })
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=15552000')
  }
  next()
})
const { requireSyncSecret, requireAuth } = require('./auth')

app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

// Request bodies are only read after the caller has proven who they are, and only as
// large as that route needs. Both checks use headers alone (the sync secret, the
// session cookie), so they can run before any body is parsed. Otherwise anyone could
// make the server read 50 MB through the login form without an account.
// - A teacher's sync can carry base64 homework attachments and material text: 50 MB.
// - A student's routes carry at most one 20 MB submission (~27 MB as base64): 30 MB.
// - Everything else (login, signup, admin) is small JSON: the 100 KB default.
app.use('/api/sync', requireSyncSecret, express.json({ limit: '50mb' }), require('./routes/sync'))
app.use('/api/me', requireAuth, express.json({ limit: '30mb' }), require('./routes/me'))
app.use(express.json({ limit: '100kb' }))
app.use('/api/invites', require('./routes/invites'))
app.use('/api/auth', require('./routes/auth'))
app.use('/api/admin', require('./routes/admin'))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// Express's default handler answers with an HTML page that includes the stack trace
// outside production. Never show internals to a browser. Log them server-side and
// return a plain JSON error the Portal page already knows how to display.
// Express recognises an error handler by its four parameters, so _next must stay.
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That upload is too large.' })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed request.' })
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' })
})

const port = process.env.PORT || 4790
app.listen(port, () => {
  console.log(`EduBoard Portal listening on :${port}`)
})

// Weekly parent digest email — checked hourly rather than scheduled to a precise
// moment, since this is a long-running plain `node server.js` process with no cron of
// its own; see digest.runScheduledDigestIfDue for the actual "is it due" logic (Monday
// 8am server-local, at most once every 6 days).
const { runScheduledDigestIfDue } = require('./services/digest')
setInterval(
  () => {
    runScheduledDigestIfDue().catch((err) => console.error('Digest scheduler error:', err.message))
  },
  60 * 60 * 1000
)
