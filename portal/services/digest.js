// Builds and sends the weekly parent digest email — one email per family account with
// an email on file, summarizing what's changed for their student(s): current
// grades/attendance, homework due in the next 7 days, recent Class Story posts, and an
// unread-messages nudge. Deliberately a snapshot, not a full activity log — a parent
// skimming on their phone wants "what do I need to know this week," not a transcript.
const db = require('../db')
const { sendMail, markDigestSent, getDigestSettings } = require('./mailer')

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function buildDigestHtml(account) {
  const studentIds = db
    .prepare('SELECT student_id FROM account_students WHERE account_id = ?')
    .all(account.id)
    .map((r) => r.student_id)

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const sections = studentIds.map((studentId) => {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
    const classes = db
      .prepare(
        `SELECT c.id, c.name, g.percent, g.letter, g.attendance_rate FROM enrollments e
         JOIN classes c ON c.id = e.class_id
         LEFT JOIN grades g ON g.student_id = e.student_id AND g.class_id = e.class_id
         WHERE e.student_id = ? AND e.status = 'active'`
      )
      .all(studentId)

    const classRows = classes
      .map(
        (c) => `<tr>
          <td style="padding:4px 8px">${esc(c.name)}</td>
          <td style="padding:4px 8px">${c.percent != null ? Math.round(c.percent) + '% (' + esc(c.letter || '') + ')' : 'No grade yet'}</td>
          <td style="padding:4px 8px">${c.attendance_rate != null ? Math.round(c.attendance_rate * 100) + '%' : '—'}</td>
        </tr>`
      )
      .join('')

    const classIds = classes.map((c) => c.id)
    let dueSoon = []
    if (classIds.length) {
      const placeholders = classIds.map(() => '?').join(',')
      dueSoon = db
        .prepare(
          `SELECT title, due_date FROM homework_assignments
           WHERE class_id IN (${placeholders}) AND due_date IS NOT NULL
             AND due_date BETWEEN ? AND ?
           ORDER BY due_date`
        )
        .all(...classIds, new Date().toISOString(), weekAhead)
    }
    const dueList = dueSoon.length
      ? `<ul>${dueSoon.map((h) => `<li>${esc(h.title)} — due ${esc((h.due_date || '').slice(0, 10))}</li>`).join('')}</ul>`
      : '<p style="color:#64748b; margin:4px 0">Nothing due this week.</p>'

    return `
      <h3 style="margin:20px 0 6px">${esc(student.first_name)} ${esc(student.last_name)}</h3>
      <table style="border-collapse:collapse; width:100%; font-size:14px">
        <tr style="color:#64748b; text-align:left">
          <th style="padding:4px 8px">Class</th><th style="padding:4px 8px">Grade</th><th style="padding:4px 8px">Attendance</th>
        </tr>
        ${classRows}
      </table>
      <p style="margin:10px 0 2px; font-weight:600">Due this week</p>
      ${dueList}`
  })

  const unread = db
    .prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE account_id = ? AND sender = 'teacher' AND read_by_family = 0"
    )
    .get(account.id).n

  const posts = db
    .prepare(
      `SELECT p.body, c.name AS class_name FROM class_posts p
       JOIN classes c ON c.id = p.class_id
       WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT 5`
    )
    .all(weekAgo)
  const postsHtml = posts.length
    ? `<ul>${posts.map((p) => `<li><strong>${esc(p.class_name)}:</strong> ${esc(p.body)}</li>`).join('')}</ul>`
    : '<p style="color:#64748b; margin:4px 0">No updates this week.</p>'

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; max-width:560px; margin:0 auto; color:#0f172a">
      <h2 style="margin-bottom:4px">Weekly update</h2>
      ${sections.join('')}
      <p style="margin:20px 0 2px; font-weight:600">Class Story</p>
      ${postsHtml}
      ${unread ? `<p style="margin-top:16px; padding:10px; background:#fef3c7; border-radius:8px">You have ${unread} unread message${unread === 1 ? '' : 's'} from the teacher — log in to the Portal to read ${unread === 1 ? 'it' : 'them'}.</p>` : ''}
    </div>`
}

/** Emails every account that has both an email on file and at least one linked
 * student — accounts with no email set are silently skipped, not an error, since a
 * family isn't required to provide one. */
async function sendAllDigests() {
  const accounts = db
    .prepare(
      `SELECT DISTINCT a.* FROM accounts a
       JOIN account_students acs ON acs.account_id = a.id
       WHERE a.email IS NOT NULL AND a.email != ''`
    )
    .all()

  let sent = 0
  const errors = []
  for (const account of accounts) {
    try {
      await sendMail(account.email, 'Your weekly EduBoard update', buildDigestHtml(account))
      sent++
    } catch (err) {
      errors.push({ username: account.username, error: err.message })
    }
  }
  markDigestSent()
  return { sent, total: accounts.length, errors }
}

/** Runs hourly from server.js — sends once a week, on Monday, in the 8am-9am server-
 * local hour, and only if a send hasn't already gone out in the last 6 days (guards
 * against firing twice if the check happens to land in that hour more than once, e.g.
 * after a restart). */
async function runScheduledDigestIfDue() {
  const settings = getDigestSettings()
  if (!settings || !settings.enabled) return
  const now = new Date()
  if (now.getDay() !== 1 || now.getHours() !== 8) return
  if (settings.last_sent_at) {
    const daysSince = (now - new Date(settings.last_sent_at)) / (24 * 60 * 60 * 1000)
    if (daysSince < 6) return
  }
  try {
    await sendAllDigests()
  } catch (err) {
    console.error('Scheduled digest send failed:', err.message)
  }
}

module.exports = { buildDigestHtml, sendAllDigests, runScheduledDigestIfDue }
