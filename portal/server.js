const path = require('path')
const express = require('express')
const cookieParser = require('cookie-parser')

const app = express()
app.use(express.json())
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
