// Relays EduBoard desktop releases from GitHub, so the desktop app can update itself
// through this server. In mainland China GitHub is often slow or blocked, while a
// Portal server (e.g. in Hong Kong) reaches it fine.
const express = require('express')
const { Readable } = require('stream')
const { rateLimit } = require('../rateLimit')

const router = express.Router()
const RELEASE_API =
  process.env.APP_RELEASE_API || 'https://api.github.com/repos/purysho/EduBoard/releases/latest'
const CACHE_MS = 10 * 60 * 1000
// Only the files an update actually uses are relayed.
const RELAYED = /\.(exe|dmg|zip|AppImage)$/

let cached = null

/** The newest release, asked of GitHub at most every ten minutes. */
async function latestRelease() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.release
  const res = await fetch(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'EduBoard-Portal' },
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
  const body = await res.json()
  const release = {
    version: String(body.tag_name || '').replace(/^v/, ''),
    assets: (body.assets || [])
      .filter((a) => RELAYED.test(a.name))
      .map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url }))
  }
  cached = { at: Date.now(), release }
  return release
}

router.get('/', async (_req, res) => {
  try {
    const { version, assets } = await latestRelease()
    res.set('Cache-Control', 'no-cache').json({
      version,
      assets: assets.map(({ name, size }) => ({ name, size }))
    })
  } catch (err) {
    res.status(502).json({ error: `Couldn't check GitHub for updates: ${err.message}` })
  }
})

// Each download is 100–270 MB of this server's bandwidth: a few an hour per address.
router.get(
  '/download/:name',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 12 }),
  async (req, res) => {
    let release
    try {
      release = await latestRelease()
    } catch (err) {
      return res.status(502).json({ error: `Couldn't reach GitHub: ${err.message}` })
    }
    const asset = release.assets.find((a) => a.name === req.params.name)
    if (!asset) return res.status(404).json({ error: 'No such download' })
    try {
      const upstream = await fetch(asset.url, { headers: { 'User-Agent': 'EduBoard-Portal' } })
      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({ error: `GitHub answered ${upstream.status}` })
      }
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${asset.name}"`,
        'Content-Length': String(asset.size)
      })
      Readable.fromWeb(upstream.body).pipe(res)
    } catch (err) {
      if (!res.headersSent) res.status(502).json({ error: `Couldn't reach GitHub: ${err.message}` })
      else res.destroy(err)
    }
  }
)

module.exports = { router, latestRelease }
