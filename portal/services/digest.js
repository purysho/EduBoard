// Builds and sends the weekly parent digest email — one email per family account with
// an email on file, summarizing what's changed for their student(s): current
// grades/attendance, homework due in the next 7 days, recent Class Story posts, and an
// unread-messages nudge. Deliberately a snapshot, not a full activity log — a parent
// skimming on their phone wants "what do I need to know this week," not a transcript.
const db = require('../db')
const { sendMail, markDigestSent, getDigestSettings, digestOptions } = require('./mailer')

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  )
}

// The digest's own words in the teacher's language (the desktop app sends it). What
// the teacher wrote (class names, posts, the newsletter) is sent as written.
const WORDS = {
  en: {
    title: 'Weekly update',
    subject: 'Your weekly EduBoard update',
    class: 'Class',
    grade: 'Grade',
    attendance: 'Attendance',
    noGrade: 'No grade yet',
    dueThisWeek: 'Due this week',
    nothingDue: 'Nothing due this week.',
    due: 'due',
    classStory: 'Class Story',
    noUpdates: 'No updates this week.',
    fromTeacher: 'From the teacher',
    unread: (n) =>
      `You have ${n} unread message${n === 1 ? '' : 's'} from the teacher — log in to the Portal to read ${n === 1 ? 'it' : 'them'}.`
  },
  zh: {
    title: '每周简报',
    subject: 'EduBoard 每周简报',
    class: '班级',
    grade: '成绩',
    attendance: '出勤率',
    noGrade: '暂无成绩',
    dueThisWeek: '本周到期的作业',
    nothingDue: '本周没有到期的作业。',
    due: '截止',
    classStory: '班级动态',
    noUpdates: '本周没有新动态。',
    fromTeacher: '老师的话',
    unread: (n) => `老师给您发了 ${n} 条未读消息，请登录学生门户查看。`
  }
}

function wordsFor(settings) {
  return WORDS[settings?.language] || WORDS.en
}

/** The teacher's newsletter as safe HTML: their text, escaped, blank lines as paragraph
 * breaks and lines starting "- " as a list. Included only until its end date. */
function newsletterHtml(settings, now = new Date()) {
  const text = (settings?.newsletter || '').trim()
  if (!text) return ''
  if (settings.newsletter_until && new Date(settings.newsletter_until) < now) return ''
  const blocks = text.split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n')
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`
    }
    if (/^#{1,3}\s/.test(lines[0])) {
      const [head, ...rest] = lines
      return `<p style="margin:10px 0 2px; font-weight:600">${esc(head.replace(/^#+\s*/, ''))}</p>${
        rest.length ? `<p style="margin:4px 0">${rest.map(esc).join('<br>')}</p>` : ''
      }`
    }
    return `<p style="margin:6px 0">${lines.map(esc).join('<br>')}</p>`
  })
  return `<div style="margin:12px 0; padding:12px; background:#f1f5f9; border-radius:8px">
    <p style="margin:0 0 4px; font-weight:600">${esc(wordsFor(settings).fromTeacher)}</p>
    ${blocks.join('')}
  </div>`
}

function buildDigestHtml(account, teacherId) {
  const settings = getDigestSettings(teacherId)
  const w = wordsFor(settings)
  const show = digestOptions(settings)
  const studentIds = db
    .prepare(
      `SELECT acs.student_id FROM account_students acs
       JOIN students s ON s.id = acs.student_id
       WHERE acs.account_id = ? AND s.teacher_id = ?`
    )
    .all(account.id, teacherId)
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

    const table =
      show.grades || show.attendance
        ? `<table style="border-collapse:collapse; width:100%; font-size:14px">
        <tr style="color:#64748b; text-align:left">
          <th style="padding:4px 8px">${esc(w.class)}</th>
          ${show.grades ? `<th style="padding:4px 8px">${esc(w.grade)}</th>` : ''}
          ${show.attendance ? `<th style="padding:4px 8px">${esc(w.attendance)}</th>` : ''}
        </tr>
        ${classes
          .map(
            (c) => `<tr>
          <td style="padding:4px 8px">${esc(c.name)}</td>
          ${show.grades ? `<td style="padding:4px 8px">${c.percent != null ? Math.round(c.percent) + '% (' + esc(c.letter || '') + ')' : esc(w.noGrade)}</td>` : ''}
          ${show.attendance ? `<td style="padding:4px 8px">${c.attendance_rate != null ? Math.round(c.attendance_rate * 100) + '%' : '—'}</td>` : ''}
        </tr>`
          )
          .join('')}
      </table>`
        : ''

    let dueHtml = ''
    if (show.homework) {
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
      dueHtml = `<p style="margin:10px 0 2px; font-weight:600">${esc(w.dueThisWeek)}</p>${
        dueSoon.length
          ? `<ul>${dueSoon.map((h) => `<li>${esc(h.title)} — ${esc(w.due)} ${esc((h.due_date || '').slice(0, 10))}</li>`).join('')}</ul>`
          : `<p style="color:#64748b; margin:4px 0">${esc(w.nothingDue)}</p>`
      }`
    }

    return `
      <h3 style="margin:20px 0 6px">${esc(student.first_name)} ${esc(student.last_name)}</h3>
      ${table}
      ${dueHtml}`
  })

  let postsHtml = ''
  if (show.classStory) {
    const classIdsForFamily = studentIds.length
      ? db
          .prepare(
            `SELECT DISTINCT class_id FROM enrollments WHERE student_id IN (${studentIds.map(() => '?').join(',')})`
          )
          .all(...studentIds)
          .map((r) => r.class_id)
      : []
    const posts = classIdsForFamily.length
      ? db
          .prepare(
            `SELECT p.body, c.name AS class_name FROM class_posts p
             JOIN classes c ON c.id = p.class_id
             WHERE p.created_at >= ? AND p.class_id IN (${classIdsForFamily.map(() => '?').join(',')})
             ORDER BY p.created_at DESC LIMIT 5`
          )
          .all(weekAgo, ...classIdsForFamily)
      : []
    postsHtml = `<p style="margin:20px 0 2px; font-weight:600">${esc(w.classStory)}</p>${
      posts.length
        ? `<ul>${posts.map((p) => `<li><strong>${esc(p.class_name)}:</strong> ${esc(p.body)}</li>`).join('')}</ul>`
        : `<p style="color:#64748b; margin:4px 0">${esc(w.noUpdates)}</p>`
    }`
  }

  const unread = show.messages
    ? db
        .prepare(
          "SELECT COUNT(*) AS n FROM messages WHERE account_id = ? AND sender = 'teacher' AND read_by_family = 0"
        )
        .get(account.id).n
    : 0

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; max-width:560px; margin:0 auto; color:#0f172a">
      <h2 style="margin-bottom:4px">${esc(w.title)}</h2>
      ${newsletterHtml(settings)}
      ${sections.join('')}
      ${postsHtml}
      ${unread ? `<p style="margin-top:16px; padding:10px; background:#fef3c7; border-radius:8px">${esc(w.unread(unread))}</p>` : ''}
    </div>`
}

/** What each family would get this week, for the teacher to look at before it goes:
 * every family account with a student of theirs, whether or not it has an email yet. */
function previewDigests(teacherId) {
  const accounts = db
    .prepare(
      `SELECT DISTINCT a.* FROM accounts a
       JOIN account_students acs ON acs.account_id = a.id
       JOIN students s ON s.id = acs.student_id
       WHERE s.teacher_id = ?
       ORDER BY a.username`
    )
    .all(teacherId)
  return accounts.slice(0, 200).map((account) => ({
    accountId: account.id,
    username: account.username,
    email: account.email || null,
    students: db
      .prepare(
        `SELECT s.first_name, s.last_name FROM account_students acs
         JOIN students s ON s.id = acs.student_id
         WHERE acs.account_id = ? AND s.teacher_id = ?`
      )
      .all(account.id, teacherId)
      .map((s) => `${s.first_name} ${s.last_name}`),
    html: buildDigestHtml(account, teacherId)
  }))
}

/** Emails every account that has both an email on file and at least one linked
 * student — accounts with no email set are silently skipped, not an error, since a
 * family isn't required to provide one. */
async function sendAllDigests(teacherId) {
  const accounts = db
    .prepare(
      `SELECT DISTINCT a.* FROM accounts a
       JOIN account_students acs ON acs.account_id = a.id
       JOIN students s ON s.id = acs.student_id
       WHERE a.email IS NOT NULL AND a.email != '' AND s.teacher_id = ?`
    )
    .all(teacherId)

  let sent = 0
  const errors = []
  for (const account of accounts) {
    try {
      await sendMail(
        teacherId,
        account.email,
        wordsFor(getDigestSettings(teacherId)).subject,
        buildDigestHtml(account, teacherId)
      )
      sent++
    } catch (err) {
      errors.push({ username: account.username, error: err.message })
    }
  }
  markDigestSent(teacherId)
  return { sent, total: accounts.length, errors }
}

/** Runs hourly from server.js — sends once a week, on Monday, in the 8am-9am server-
 * local hour, and only if a send hasn't already gone out in the last 6 days (guards
 * against firing twice if the check happens to land in that hour more than once, e.g.
 * after a restart). */
async function runScheduledDigestIfDue() {
  const now = new Date()
  if (now.getDay() !== 1 || now.getHours() !== 8) return
  const teachers = db.prepare('SELECT id FROM teachers').all()
  for (const { id: teacherId } of teachers) {
    const settings = getDigestSettings(teacherId)
    if (!settings || !settings.enabled) continue
    if (settings.last_sent_at) {
      const daysSince = (now - new Date(settings.last_sent_at)) / (24 * 60 * 60 * 1000)
      if (daysSince < 6) continue
    }
    try {
      await sendAllDigests(teacherId)
    } catch (err) {
      console.error(`Scheduled digest send failed for teacher ${teacherId}:`, err.message)
    }
  }
}

module.exports = {
  buildDigestHtml,
  newsletterHtml,
  previewDigests,
  sendAllDigests,
  runScheduledDigestIfDue
}
