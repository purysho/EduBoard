// A family's homework due dates as an iCalendar feed (RFC 5545), for the private link on
// the Account page. Calendar apps (Apple, Google, Outlook, most phone calendars) fetch
// it by themselves every few hours, so due dates and "handed in" ticks stay up to date.
const db = require('../db')
const { hashToken, newRandomToken } = require('../auth')
const { escapeText, fold } = require('./ics')
const { brandName } = require('./branding')
const { reviewSchedule } = require('./review')

const WORDS = {
  en: {
    calendar: (name) => `${name} homework`,
    handedIn: 'Handed in',
    notYet: 'Not handed in yet',
    review: (n) => `Review: ${n} card${n === 1 ? '' : 's'}`,
    reviewNote: 'A few minutes of recall on the Portal (Study → Today’s review).'
  },
  zh: {
    calendar: (name) => `${name} 作业`,
    handedIn: '已提交',
    notYet: '尚未提交',
    review: (n) => `复习：${n} 张卡片`,
    reviewNote: '在门户上花几分钟回忆（学习 → 今日复习）。'
  }
}

const compactDate = (d) => d.replace(/-/g, '')
const nextDay = (d) => {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

/** The feed for one login: every linked child's homework with a due date, in classes
 * that aren't finished. */
function buildCalendar(accountId, lang, portalUrl) {
  const w = WORDS[lang] || WORDS.en
  const students = db
    .prepare(
      `SELECT s.id, s.first_name FROM account_students a JOIN students s ON s.id = a.student_id
       WHERE a.account_id = ? ORDER BY s.first_name`
    )
    .all(accountId)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EduBoard//Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(w.calendar(brandName()))}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    'X-PUBLISHED-TTL:PT4H'
  ]
  for (const student of students) {
    const homework = db
      .prepare(
        `SELECT h.id, h.title, h.due_date, c.name AS class_name, sub.status
         FROM enrollments e
         JOIN classes c ON c.id = e.class_id
         JOIN homework_assignments h ON h.class_id = c.id
         LEFT JOIN homework_submissions sub
           ON sub.homework_assignment_id = h.id AND sub.student_id = e.student_id
         WHERE e.student_id = ? AND e.status = 'active' AND c.finished = 0
           AND h.due_date IS NOT NULL`
      )
      .all(student.id)
    for (const h of homework) {
      const day = String(h.due_date).slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      const done = h.status === 'submitted' || h.status === 'done'
      const who = students.length > 1 ? ` (${student.first_name})` : ''
      lines.push(
        'BEGIN:VEVENT',
        `UID:${h.id}.${student.id}@eduboard-portal`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compactDate(day)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDay(day))}`,
        `SUMMARY:${escapeText(`${done ? '✓ ' : ''}${h.title}${who}`)}`,
        `DESCRIPTION:${escapeText(`${h.class_name}\n${done ? w.handedIn : w.notYet}\n${portalUrl}`)}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      )
    }
    // Spaced-review days for the next two weeks, as the cards stand today. The feed
    // refreshes every few hours, so answering cards moves these along.
    const today = new Date().toISOString().slice(0, 10)
    for (const { date, count } of reviewSchedule(student.id, today, 14)) {
      if (!count) continue
      const who = students.length > 1 ? ` (${student.first_name})` : ''
      lines.push(
        'BEGIN:VEVENT',
        `UID:review-${date}.${student.id}@eduboard-portal`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compactDate(date)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDay(date))}`,
        `SUMMARY:${escapeText(`${w.review(count)}${who}`)}`,
        `DESCRIPTION:${escapeText(`${w.reviewNote}\n${portalUrl}`)}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** A new private link for this login; any earlier link stops working. */
function newCalendarToken(accountId) {
  const token = newRandomToken()
  db.prepare('UPDATE accounts SET calendar_token_hash = ? WHERE id = ?').run(
    hashToken(token),
    accountId
  )
  return token
}

function turnOffCalendar(accountId) {
  db.prepare('UPDATE accounts SET calendar_token_hash = NULL WHERE id = ?').run(accountId)
}

function calendarOn(accountId) {
  return !!db.prepare('SELECT calendar_token_hash AS h FROM accounts WHERE id = ?').get(accountId)
    ?.h
}

function accountForCalendarToken(token) {
  if (typeof token !== 'string' || token.length < 20) return null
  return (
    db.prepare('SELECT id FROM accounts WHERE calendar_token_hash = ?').get(hashToken(token))?.id ??
    null
  )
}

module.exports = {
  buildCalendar,
  newCalendarToken,
  turnOffCalendar,
  calendarOn,
  accountForCalendarToken
}
