// Thin wrapper around the teacher's own SMTP config for the weekly parent digest —
// no third-party email API, no added recurring cost beyond whatever mailbox they
// already have (a Gmail app password works fine for this volume).
const nodemailer = require('nodemailer')
const db = require('../db')

class DigestNotConfiguredError extends Error {
  constructor() {
    super('Weekly digest email isn’t set up yet — add SMTP details in Settings.')
    this.name = 'DigestNotConfiguredError'
  }
}

function getDigestSettings(teacherId) {
  return db.prepare('SELECT * FROM digest_settings WHERE teacher_id = ?').get(teacherId)
}

function saveDigestSettings(
  teacherId,
  {
    enabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    fromEmail,
    fromName,
    options,
    language,
    teacherEmail
  }
) {
  db.prepare(
    `INSERT INTO digest_settings (teacher_id, enabled, smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(teacher_id) DO UPDATE SET
       enabled = excluded.enabled,
       smtp_host = excluded.smtp_host,
       smtp_port = excluded.smtp_port,
       smtp_user = excluded.smtp_user,
       smtp_pass = excluded.smtp_pass,
       from_email = excluded.from_email,
       from_name = excluded.from_name`
  ).run(
    teacherId,
    enabled ? 1 : 0,
    smtpHost || '',
    smtpPort || 587,
    smtpUser || '',
    smtpPass || '',
    fromEmail || '',
    fromName || ''
  )
  // Sent by newer desktop apps only; an older one leaves them as they were.
  if (options && typeof options === 'object') {
    const clean = {}
    for (const key of DIGEST_PARTS) clean[key] = partOn(key, options[key])
    db.prepare('UPDATE digest_settings SET options = ? WHERE teacher_id = ?').run(
      JSON.stringify(clean),
      teacherId
    )
  }
  if (language === 'en' || language === 'zh') {
    db.prepare('UPDATE digest_settings SET language = ? WHERE teacher_id = ?').run(
      language,
      teacherId
    )
  }
  if (typeof teacherEmail === 'string') {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail.trim())
      ? teacherEmail.trim()
      : null
    db.prepare('UPDATE digest_settings SET teacher_email = ? WHERE teacher_id = ?').run(
      email,
      teacherId
    )
  }
}

/** The parts of the family digest a teacher can switch on or off. */
const DIGEST_PARTS = ['grades', 'attendance', 'homework', 'classStory', 'messages', 'points']
/** Parts families only get once the teacher turns them on. */
const OFF_UNLESS_CHOSEN = ['points']
const partOn = (key, value) => (OFF_UNLESS_CHOSEN.includes(key) ? value === true : value !== false)

/** What families get: each part on unless the teacher switched it off (or, for the
 * parts in OFF_UNLESS_CHOSEN, off unless they switched it on). */
function digestOptions(settings) {
  let saved = {}
  try {
    saved = settings?.options ? JSON.parse(settings.options) : {}
  } catch {
    // Unreadable: everything on.
  }
  return Object.fromEntries(DIGEST_PARTS.map((key) => [key, partOn(key, saved[key])]))
}

function markDigestSent(teacherId) {
  db.prepare('UPDATE digest_settings SET last_sent_at = ? WHERE teacher_id = ?').run(
    new Date().toISOString(),
    teacherId
  )
}

function getTransport(teacherId) {
  const s = getDigestSettings(teacherId)
  if (!s || !s.enabled || !s.smtp_host || !s.from_email) throw new DigestNotConfiguredError()
  const transport = nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: s.smtp_port === 465,
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined
  })
  return { transport, from: s.from_name ? `"${s.from_name}" <${s.from_email}>` : s.from_email }
}

async function sendMail(teacherId, to, subject, html) {
  const { transport, from } = getTransport(teacherId)
  await transport.sendMail({ from, to, subject, html })
}

module.exports = {
  DIGEST_PARTS,
  digestOptions,
  getDigestSettings,
  saveDigestSettings,
  markDigestSent,
  sendMail,
  DigestNotConfiguredError
}
