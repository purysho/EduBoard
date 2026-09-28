// The public demo login (PORTAL_DEMO=1): a made-up class under its own teacher, and a
// family account anyone can sign in with (username demo) to see what families see.
// It's reset on start and every day, its password, email and QR logins can't be changed,
// and it's left out of the admin page's usage numbers. Nothing here touches a real
// teacher's classes: everything is keyed to DEMO_TEACHER_ID.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../db')
const { hashPassword, hashToken, newRandomToken } = require('../auth')
const { REPORT_CARDS_DIR } = require('../paths')

const DEMO_TEACHER_ID = 'demo-teacher'
const DEMO_USERNAME = 'demo'
const DEMO_PASSWORD = 'try-eduboard'
const CLASS_ID = 'demo-class-4b'
const STUDENTS = [
  ['demo-s1', 'Amy', 'Chen', 93, 'A', 0.98],
  ['demo-s2', 'Leo', 'Wang', 81, 'B', 0.95],
  ['demo-s3', 'Cindy', 'Li', 74, 'C', 0.9]
]

const enabled = () => process.env.PORTAL_DEMO === '1'
fs.mkdirSync(REPORT_CARDS_DIR, { recursive: true })

/** Whether an account is the demo login (so it can't be changed). */
function isDemoAccount(accountId) {
  const row = db.prepare('SELECT username FROM accounts WHERE id = ?').get(accountId)
  return !!row && row.username.toLowerCase() === DEMO_USERNAME && demoAccountId() === accountId
}

function demoAccountId() {
  return (
    db
      .prepare(
        `SELECT a.id FROM accounts a JOIN account_students s ON s.account_id = a.id
         WHERE a.username = ? AND s.student_id = ?`
      )
      .get(DEMO_USERNAME, STUDENTS[0][0])?.id ?? null
  )
}

/** A one-page PDF with a few lines of text: the demo's sample report card. */
function samplePdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c)
  const text = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 60 ${760 - i * 26} Td (${esc(l)}) Tj ET`)
    .join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out)
}

/** Puts the demo back as new: everything of the demo teacher's is removed and made again. */
function resetDemo(now = new Date()) {
  const day = (n) => new Date(now.getTime() + n * 86400000).toISOString()
  const oldFiles = db
    .prepare(
      `SELECT r.file_path FROM report_cards r JOIN classes c ON c.id = r.class_id
       WHERE c.teacher_id = ?`
    )
    .all(DEMO_TEACHER_ID)
  const fileName = `${crypto.randomUUID()}.pdf`

  db.transaction(() => {
    const oldAccount = demoAccountId()
    const studentIds = STUDENTS.map((s) => s[0])
    const inStudents = `(${studentIds.map(() => '?').join(',')})`
    for (const sql of [
      `DELETE FROM report_cards WHERE class_id = '${CLASS_ID}'`,
      `DELETE FROM class_posts WHERE class_id = '${CLASS_ID}'`,
      `DELETE FROM homework_submissions WHERE homework_assignment_id IN (SELECT id FROM homework_assignments WHERE class_id = '${CLASS_ID}')`,
      `DELETE FROM homework_assignments WHERE class_id = '${CLASS_ID}'`,
      `DELETE FROM grades WHERE class_id = '${CLASS_ID}'`,
      `DELETE FROM enrollments WHERE class_id = '${CLASS_ID}'`
    ]) {
      db.prepare(sql).run()
    }
    for (const table of ['student_profiles', 'ai_interactions', 'account_students']) {
      db.prepare(`DELETE FROM ${table} WHERE student_id IN ${inStudents}`).run(...studentIds)
    }
    if (oldAccount) db.prepare('DELETE FROM accounts WHERE id = ?').run(oldAccount)
    db.prepare(`DELETE FROM students WHERE id IN ${inStudents}`).run(...studentIds)
    db.prepare('DELETE FROM classes WHERE id = ?').run(CLASS_ID)

    // The demo teacher's sync secret is random and never shown: nobody can publish as it.
    db.prepare(
      `INSERT OR IGNORE INTO teachers (id, name, sync_secret_hash, created_at) VALUES (?, ?, ?, ?)`
    ).run(DEMO_TEACHER_ID, 'Sample school (demo)', hashToken(newRandomToken()), day(0))
    db.prepare('INSERT INTO classes (id, teacher_id, name, level_type) VALUES (?, ?, ?, ?)').run(
      CLASS_ID,
      DEMO_TEACHER_ID,
      'Grade 4 English (4B) · sample',
      'k12'
    )
    for (const [id, first, last, percent, letter, attendance] of STUDENTS) {
      db.prepare(
        'INSERT INTO students (id, teacher_id, first_name, last_name, date_of_birth, student_number) VALUES (?, ?, ?, ?, NULL, NULL)'
      ).run(id, DEMO_TEACHER_ID, first, last)
      db.prepare(
        "INSERT INTO enrollments (student_id, class_id, status) VALUES (?, ?, 'active')"
      ).run(id, CLASS_ID)
      db.prepare(
        'INSERT INTO grades (student_id, class_id, percent, letter, attendance_rate, points) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        CLASS_ID,
        percent,
        letter,
        attendance,
        JSON.stringify([
          { name: 'Helping others', total: 3 },
          { name: 'Great answer', total: 2 }
        ])
      )
    }
    const hw = (id, title, description, due) =>
      db
        .prepare(
          'INSERT INTO homework_assignments (id, class_id, title, description, due_date, topic) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(id, CLASS_ID, title, description, due.slice(0, 10), 'Unit 1: My family')
    hw(
      'demo-hw1',
      'Write about your weekend',
      'Five sentences about what you did. Use the past tense.',
      day(3)
    )
    hw(
      'demo-hw2',
      'Read chapter 3',
      'Read chapter 3 of the class reader and find three new words.',
      day(-4)
    )
    db.prepare(
      "INSERT INTO homework_submissions (homework_assignment_id, student_id, status, submitted_at, updated_at, text_answer, grade, feedback, graded_at) VALUES ('demo-hw2', 'demo-s1', 'done', ?, ?, 'grandmother, garden, delicious', 'A', 'Lovely choice of words, Amy!', ?)"
    ).run(day(-5), day(-5), day(-3))

    const post = (id, body, ago, kind = null, question = null) =>
      db
        .prepare(
          'INSERT INTO class_posts (id, class_id, body, created_at, reply_kind, reply_question) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(id, CLASS_ID, body, day(-ago), kind, question)
    post(
      'demo-p1',
      'We started Unit 1 this week: families. Ask your child to tell you who is in their family, in English!',
      6
    )
    post(
      'demo-p2',
      'Museum trip next Friday. We leave at 9:00 and are back by 15:00. Please bring a packed lunch.',
      1,
      'yesno',
      'May your child come on the trip?'
    )

    db.prepare(
      'INSERT INTO report_cards (id, class_id, student_id, title, file_path, published_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('demo-rc1', CLASS_ID, 'demo-s1', 'Mid-term report (sample)', fileName, day(-2))

    const accountId = crypto.randomUUID()
    db.prepare(
      'INSERT INTO accounts (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(accountId, DEMO_USERNAME, hashPassword(DEMO_PASSWORD), day(0))
    db.prepare('INSERT INTO account_students (account_id, student_id) VALUES (?, ?)').run(
      accountId,
      'demo-s1'
    )
    db.prepare(
      "INSERT INTO messages (id, account_id, sender, body, created_at, read_by_teacher, read_by_family) VALUES (?, ?, 'teacher', ?, ?, 1, 0)"
    ).run(
      crypto.randomUUID(),
      accountId,
      'Welcome to the EduBoard demo! This is where you and your child’s teacher can message each other. Try the Translate button.',
      day(-1)
    )
  })()

  fs.writeFileSync(
    path.join(REPORT_CARDS_DIR, fileName),
    samplePdf([
      'Mid-term report (sample)',
      'Amy Chen · Grade 4 English (4B)',
      '',
      'Overall: 93% (A)        Attendance: 98%',
      'Class points: Helping others 3 · Great answer 2',
      '',
      'Amy has made real progress this term and joins in every lesson.',
      '',
      'This is a made-up student in the EduBoard demo.'
    ])
  )
  for (const r of oldFiles) fs.rmSync(path.join(REPORT_CARDS_DIR, r.file_path), { force: true })
}

/** Resets the demo now and once a day, if PORTAL_DEMO=1. */
function startDemo() {
  if (!enabled()) return
  const run = () => {
    try {
      resetDemo()
    } catch (err) {
      console.error('Demo reset failed:', err.message)
    }
  }
  run()
  setInterval(run, 24 * 60 * 60 * 1000).unref()
}

module.exports = {
  DEMO_TEACHER_ID,
  DEMO_USERNAME,
  DEMO_PASSWORD,
  enabled,
  isDemoAccount,
  resetDemo,
  startDemo
}
