const path = require('path')
const crypto = require('crypto')
const express = require('express')
const { rateLimit: expressRateLimit } = require('express-rate-limit')
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

// Portal-wide DoS guard. This deliberately sits above the route-specific limiters:
// - it gives every dynamic/file/database route a coarse safety ceiling;
// - the stricter EduBoard limits still govern login failures, secret guessing, AI spend,
//   password changes, invites and uploads;
// - the default is high enough for several classrooms sharing one NAT address.
// express-rate-limit is used directly here so GitHub CodeQL can recognize the guard
// (js/missing-rate-limiting); RATE_PORTAL_PER_IP_PER_MINUTE can be raised for a very
// large school deployment without weakening the sensitive endpoint limits below.
function positiveEnvInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}
const portalWideLimiter = expressRateLimit({
  windowMs: 60 * 1000,
  limit: positiveEnvInt('RATE_PORTAL_PER_IP_PER_MINUTE', 1200),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  ipv6Subnet: 56,
  message: {
    error: 'The Portal is receiving too many requests. Please wait a moment and try again.',
    code: 'PT-1003'
  }
})
app.use(portalWideLimiter)

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // QR-login and invite links carry secrets in the URL; never leak them via Referer.
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin'
  })
  // Any request that arrived over HTTPS tells the browser to keep using HTTPS.
  if (process.env.NODE_ENV === 'production' || req.secure) {
    res.set('Strict-Transport-Security', 'max-age=15552000')
  }
  next()
})
const { requireSyncSecret, requireAuth } = require('./auth')

app.use(cookieParser())

// EduBoard's homepage (what it is, and downloads through this server): /download on every
// Portal, and the front page for any host listed in HOMEPAGE_HOSTS (e.g. the project's
// own "edu-board.com"), where "/" would otherwise be the student login.
const HOMEPAGE = path.join(__dirname, 'public', 'download.html')
const homepageHosts = (process.env.HOMEPAGE_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)
app.get(['/download', '/download/'], (_req, res) => res.sendFile(HOMEPAGE))
// The privacy notice and the data processing terms a school can sign (both languages).
app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')))
app.get('/security', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'security.html')))
app.get('/terms', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')))
app.get('/brochure', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'brochure.html')))
// Where security researchers look for a contact (RFC 9116).
app.get('/.well-known/security.txt', (req, res) => {
  const expires = new Date(Date.now() + 180 * 86400000).toISOString()
  res
    .type('text/plain')
    .send(
      [
        'Contact: mailto:privacy@edu-board.com',
        `Expires: ${expires}`,
        'Preferred-Languages: en, zh',
        `Policy: https://${req.get('host')}/security`
      ].join('\n') + '\n'
    )
})
app.get('/data-processing', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'data-processing.html'))
)
const onHomepageHost = (req) => homepageHosts.includes((req.hostname || '').toLowerCase())
app.get('/', (req, res, next) => (onHomepageHost(req) ? res.sendFile(HOMEPAGE) : next()))
// The homepage's "Log in" links. On a homepage host "/" is the homepage itself, so they go
// to the Portal's own address (PORTAL_HOST, e.g. portal.edu-board.com), or failing that
// show the login here.
const portalHost = (process.env.PORTAL_HOST || '').trim().toLowerCase()
app.get('/login', (req, res) => {
  if (!onHomepageHost(req)) return res.redirect('/')
  if (portalHost) return res.redirect(`https://${portalHost}/`)
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})
// The Portal's name and logo (services/branding.js): the teachers' app name, or EduBoard.
// Public, since the sign-in screen shows them.
const branding = require('./services/branding')
app.get('/api/branding', (_req, res) => {
  res.set('Cache-Control', 'no-cache').json(branding.publicBranding())
})
app.get('/api/branding/logo', (_req, res) => {
  const { logo } = branding.currentBranding()
  if (!logo) return res.status(404).json({ error: 'Not found', code: 'PT-9001' })
  res
    .set({ 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'" })
    .type('image/png')
    .send(logo)
})
// The home-screen app's name and icon follow it too.
const baseManifest = JSON.parse(
  require('fs').readFileSync(path.join(__dirname, 'public', 'manifest.json'), 'utf-8')
)
app.get('/manifest.json', (_req, res) => {
  const { name, logo } = branding.publicBranding()
  const manifest = { ...baseManifest }
  const side = logo ? branding.currentBranding().logo.readUInt32BE(16) : 0
  if (name) {
    manifest.name = name
    manifest.short_name = name.length > 12 ? name.slice(0, 12).trim() : name
  }
  if (logo) {
    // Only the logo: phones prefer a "maskable" icon, and EduBoard's would win.
    manifest.icons = [{ src: logo, sizes: `${side}x${side}`, type: 'image/png', purpose: 'any' }]
  }
  res
    .set('Cache-Control', 'no-cache')
    .type('application/manifest+json')
    .send(JSON.stringify(manifest))
})
app.use(express.static(path.join(__dirname, 'public')))

// Request bodies are only read after the caller has proven who they are, and only as
// large as that route needs. Both checks use headers alone (the sync secret, the
// session cookie), so they can run before any body is parsed. Otherwise anyone could
// make the server read 50 MB through the login form without an account.
// - A teacher's sync can carry base64 homework attachments and material text: 50 MB.
// - A student's routes carry at most one 20 MB submission (~27 MB as base64): 30 MB.
// - Everything else (login, signup, admin) is small JSON: the 100 KB default.
// Express 5 leaves req.body undefined when a request has no JSON body; the routes expect
// an empty object (as Express 4 gave), so a bodyless request gets a 400, never a crash.
const emptyBody = (req, _res, next) => {
  if (req.body === undefined) req.body = {}
  next()
}
app.use(
  '/api/sync',
  requireSyncSecret,
  express.json({ limit: '50mb' }),
  emptyBody,
  require('./routes/sync')
)
app.use('/api/me', requireAuth, express.json({ limit: '30mb' }), emptyBody, require('./routes/me'))
app.use(express.json({ limit: '100kb' }), emptyBody)
app.use('/api/invites', require('./routes/invites'))
app.use('/api/auth', require('./routes/auth'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/usage', require('./routes/usage').router)

app.get('/health', (_req, res) => res.json({ ok: true }))

// A family's private calendar link (services/calendar.js). The secret in the address is
// the only key, as with other calendar feeds; the Account page can replace or turn it off.
const calendar = require('./services/calendar')
app.get('/calendar/:token.ics', (req, res) => {
  const accountId = calendar.accountForCalendarToken(req.params.token)
  if (!accountId) return res.status(404).type('text/plain').send('Not found')
  const portalUrl = `${req.protocol}://${req.get('host')}/`
  res
    .set({ 'Cache-Control': 'private, no-cache', 'X-Robots-Tag': 'noindex' })
    .type('text/calendar; charset=utf-8')
    .send(calendar.buildCalendar(accountId, req.query.lang === 'zh' ? 'zh' : 'en', portalUrl))
})

// The public demo login, for the homepage's "try it" box (services/demo.js).
const demo = require('./services/demo')
app.get('/api/demo', (_req, res) =>
  res.json(
    demo.enabled()
      ? { enabled: true, username: demo.DEMO_USERNAME, password: demo.DEMO_PASSWORD }
      : { enabled: false }
  )
)

// The newest EduBoard desktop release, relayed from GitHub (routes/appRelease.js), so
// the desktop app can check for and download updates through this server.
const appRelease = require('./routes/appRelease')
app.use('/api/app-release', appRelease.router)
// The Dashboard's "new version" notice: the newest release, or failing that the version
// this server's code was built with (portal/desktop-version.json).
app.get('/api/app-version', async (_req, res) => {
  let version
  try {
    version = (await appRelease.latestRelease()).version
  } catch {
    version = JSON.parse(
      require('fs').readFileSync(path.join(__dirname, 'desktop-version.json'), 'utf8')
    ).version
  }
  res.set('Cache-Control', 'no-cache').json({
    version,
    downloadUrl: 'https://github.com/purysho/EduBoard/releases/latest'
  })
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found', code: 'PT-9001' }))

// Express's default handler answers with an HTML page that includes the stack trace
// outside production. Never show internals to a browser. Log them server-side and
// return a plain JSON error the Portal page already knows how to display.
// Express recognises an error handler by its four parameters, so _next must stay.
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That upload is too large.', code: 'PT-3004' })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed request.', code: 'PT-9002' })
  }
  // A reference the person can quote; the same one is in the server log with the details
  // (journalctl -u eduboard-portal | grep <ref>).
  const ref = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)
  console.error(`[PT-9900 ref ${ref}] ${_req.method} ${_req.path}`, err)
  res.status(500).json({
    error: 'Something went wrong on the server. Please try again.',
    code: 'PT-9900',
    ref
  })
})

const port = process.env.PORT || 4790
// HOST=127.0.0.1 keeps a local test Portal on this computer only (and spares Windows
// users a firewall prompt). Unset, it listens on every interface as before.
const host = process.env.HOST || undefined
const server = app.listen(port, host, () => {
  // The real port, which differs from PORT when PORT=0 asks the system for a free one
  // (the tests do this so parallel test files can never collide on a port).
  console.log(`EduBoard Portal listening on ${host || ''}:${server.address().port}`)
})

// Weekly parent digest email — checked hourly rather than scheduled to a precise
// moment, since this is a long-running plain `node server.js` process with no cron of
// its own; see digest.runScheduledDigestIfDue for the actual "is it due" logic (Monday
// 8am server-local, at most once every 6 days).
demo.startDemo()

const { runScheduledDigestIfDue } = require('./services/digest')
setInterval(
  () => {
    runScheduledDigestIfDue().catch((err) => console.error('Digest scheduler error:', err.message))
  },
  60 * 60 * 1000
)
