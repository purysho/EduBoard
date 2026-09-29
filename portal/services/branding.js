// The name and logo families see on the Portal: the page's title and header, the icon when
// it's added to a phone's home screen, the weekly email's subject and the calendar's name.
//
// Each teacher's desktop app sends its own app name and logo when it publishes (Settings →
// Portal and families → "Show this app's name and logo on the Portal"). The Portal shows:
// - "auto" (the default): the name every teacher's app agrees on, so a teacher on their own
//   Portal, or a school whose teachers share one name (a school pack), gets it without
//   anyone setting anything. One teacher with a different name can't rename the Portal for
//   everyone: if the names differ, the Portal says EduBoard until the admin picks one.
// - "teacher:<id>": the admin chose that teacher's name and logo (admin page).
// - "eduboard": the admin chose EduBoard's own.
const crypto = require('crypto')
const db = require('../db')

const MAX_NAME = 60
const MAX_LOGO_BYTES = 512 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** A name as the Portal shows it: one line, no more than 60 characters; '' for none. */
function cleanName(name) {
  if (typeof name !== 'string') return ''
  return name
    .replace(/[\p{Cc}<>]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
    .trim()
}

/** The logo's bytes if they're a square PNG of a sensible size, otherwise null. Only PNG
 * is accepted (the desktop app converts the logo), so nothing the Portal serves as an
 * image can carry a script. */
function cleanLogo(base64) {
  if (typeof base64 !== 'string' || !base64) return null
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64) || base64.length > (MAX_LOGO_BYTES * 4) / 3 + 4) {
    return null
  }
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length < 33 || bytes.length > MAX_LOGO_BYTES) return null
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width !== height || width < 64 || width > 1024) return null
  return bytes
}

/** What a teacher's app sent with a publish. An older app sends nothing: left as it was. */
function saveTeacherBranding(teacherId, { appName, appLogo }) {
  if (appName === undefined && appLogo === undefined) return
  db.prepare('UPDATE teachers SET app_name = ?, app_logo = ?, branding_at = ? WHERE id = ?').run(
    cleanName(appName) || null,
    cleanLogo(appLogo),
    new Date().toISOString(),
    teacherId
  )
}

function getChoice() {
  const row = db.prepare('SELECT choice FROM portal_branding WHERE id = 1').get()
  return row?.choice || 'auto'
}

function setChoice(choice) {
  db.prepare(
    `INSERT INTO portal_branding (id, choice) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET choice = excluded.choice`
  ).run(choice)
}

/** Whether the admin page may choose this: auto, eduboard, or a teacher that exists. */
function isValidChoice(choice) {
  if (choice === 'auto' || choice === 'eduboard') return true
  const id = /^teacher:(.+)$/.exec(String(choice))?.[1]
  return !!id && !!db.prepare('SELECT 1 FROM teachers WHERE id = ?').get(id)
}

const NONE = { name: '', logo: null }

/** The name ('' means EduBoard's own) and logo (PNG bytes or null) the Portal shows now. */
function currentBranding() {
  const choice = getChoice()
  if (choice === 'eduboard') return NONE
  const chosenId = /^teacher:(.+)$/.exec(choice)?.[1]
  if (chosenId) {
    const row = db.prepare('SELECT app_name, app_logo FROM teachers WHERE id = ?').get(chosenId)
    // A teacher who has since been removed: back to automatic.
    if (row) return { name: row.app_name || '', logo: row.app_name ? row.app_logo || null : null }
  }
  const named = db
    .prepare(
      `SELECT app_name, app_logo FROM teachers WHERE app_name IS NOT NULL AND app_name != ''
       ORDER BY branding_at DESC`
    )
    .all()
  if (!named.length || new Set(named.map((r) => r.app_name)).size > 1) return NONE
  return { name: named[0].app_name, logo: named.find((r) => r.app_logo)?.app_logo || null }
}

const logoVersion = (logo) => crypto.createHash('sha256').update(logo).digest('hex').slice(0, 12)

/** For the Portal page (no sign-in needed: it's on the sign-in screen). */
function publicBranding() {
  const { name, logo } = currentBranding()
  return { name, logo: logo ? `/api/branding/logo?v=${logoVersion(logo)}` : null }
}

/** The name in the weekly email and the calendar: the Portal's, or EduBoard. */
function brandName() {
  return currentBranding().name || 'EduBoard'
}

/** For the admin page: what's shown now, the choice, and what each teacher's app sent. */
function adminBranding() {
  const teachers = db
    .prepare(
      'SELECT id, name, app_name, app_logo IS NOT NULL AS has_logo FROM teachers ORDER BY name'
    )
    .all()
    .map((t) => ({ id: t.id, name: t.name, appName: t.app_name || '', hasLogo: !!t.has_logo }))
  return { choice: getChoice(), current: publicBranding(), teachers }
}

module.exports = {
  MAX_NAME,
  cleanName,
  cleanLogo,
  saveTeacherBranding,
  setChoice,
  isValidChoice,
  currentBranding,
  publicBranding,
  brandName,
  adminBranding
}
