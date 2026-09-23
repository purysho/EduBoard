const path = require('path')
const express = require('express')
const cookieParser = require('cookie-parser')

const app = express()
// Default express.json() caps request bodies at 100kb — far below what a single sync
// payload needs once it carries a base64-encoded homework attachment (up to ~8MB raw,
// see MAX_HOMEWORK_FILE_BYTES) or several shared materials' worth of chunk text. 50mb
// covers that comfortably without leaving the limit effectively unbounded.
app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/sync', require('./routes/sync'))
app.use('/api/invites', require('./routes/invites'))
app.use('/api/auth', require('./routes/auth'))
app.use('/api/me', require('./routes/me'))

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = process.env.PORT || 4790
app.listen(port, () => {
  console.log(`EduBoard Portal listening on :${port}`)
})

// Weekly parent digest email — checked hourly rather than scheduled to a precise
// moment, since this is a long-running plain `node server.js` process with no cron of
// its own; see digest.runScheduledDigestIfDue for the actual "is it due" logic (Monday
// 8am server-local, at most once every 6 days).
const { runScheduledDigestIfDue } = require('./services/digest')
setInterval(() => {
  runScheduledDigestIfDue().catch((err) => console.error('Digest scheduler error:', err.message))
}, 60 * 60 * 1000)
