const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../db')
const { requireSyncSecret, hashPassword } = require('../auth')

const router = express.Router()
router.use(requireSyncSecret)

const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'homework-uploads')
const SUBMISSIONS_DIR = path.join(__dirname, '..', 'data', 'submission-uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true })

function sanitizeFileName(name) {
  return String(name).replace(/[^\w.\-]+/g, '_').slice(-120)
}

// Full push from the desktop app. Each table is wholesale-replaced inside one
// transaction — the desktop app always sends its complete current state, never a
// diff, so "replace everything" is simpler and can't drift out of sync from a missed
// incremental update.
router.post('/', (req, res) => {
  const {
    classes = [],
    students = [],
    enrollments = [],
    grades = [],
    homeworkAssignments = [],
    invites = []
  } = req.body

  // Every publish replaces the whole homework_assignments table (see below), so old
  // attachment files would otherwise pile up on disk forever — clear the folder first
  // and let this push repopulate only what's still current.
  for (const entry of fs.readdirSync(UPLOADS_DIR)) {
    fs.rmSync(path.join(UPLOADS_DIR, entry), { force: true })
  }

  const run = db.transaction(() => {
    db.prepare('DELETE FROM classes').run()
    db.prepare('DELETE FROM students').run()
    db.prepare('DELETE FROM enrollments').run()
    db.prepare('DELETE FROM grades').run()
    db.prepare('DELETE FROM homework_assignments').run()

    const insertClass = db.prepare('INSERT INTO classes (id, name, level_type) VALUES (?, ?, ?)')
    for (const c of classes) insertClass.run(c.id, c.name, c.levelType)

    const insertStudent = db.prepare(
      'INSERT INTO students (id, first_name, last_name, date_of_birth, student_number) VALUES (?, ?, ?, ?, ?)'
    )
    for (const s of students) {
      insertStudent.run(s.id, s.firstName, s.lastName, s.dateOfBirth, s.studentNumber)
    }

    const insertEnrollment = db.prepare(
      'INSERT OR REPLACE INTO enrollments (student_id, class_id, status) VALUES (?, ?, ?)'
    )
    for (const e of enrollments) insertEnrollment.run(e.studentId, e.classId, e.status)

    const insertGrade = db.prepare(
      'INSERT OR REPLACE INTO grades (student_id, class_id, percent, letter, attendance_rate) VALUES (?, ?, ?, ?, ?)'
    )
    for (const g of grades) {
      insertGrade.run(g.studentId, g.classId, g.percent, g.letter, g.attendanceRate)
    }

    const insertHomework = db.prepare(
      'INSERT INTO homework_assignments (id, class_id, title, description, due_date, file_name, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const h of homeworkAssignments) {
      let filePath = null
      if (h.fileName && h.fileData) {
        const storedName = `${h.id}-${sanitizeFileName(h.fileName)}`
        fs.writeFileSync(path.join(UPLOADS_DIR, storedName), Buffer.from(h.fileData, 'base64'))
        filePath = storedName
      }
      insertHomework.run(h.id, h.classId, h.title, h.description, h.dueDate, h.fileName, filePath)
    }

    // Invites are upserted, never deleted — a claimed invite's claimed_at must survive
    // being left out of a later push (the desktop only knows about the codes it
    // generated locally; it doesn't track claim state, since claiming happens here).
    const upsertInvite = db.prepare(`
      INSERT INTO invites (code, class_id, revoked, claimed_at)
      VALUES (@code, @classId, @revoked, NULL)
      ON CONFLICT(code) DO UPDATE SET revoked = @revoked
    `)
    for (const i of invites) {
      upsertInvite.run({ code: i.code, classId: i.classId, revoked: i.revoked ? 1 : 0 })
    }
  })
  run()

  res.json({ ok: true })
})

// Pull homework submission statuses students have set themselves, so the desktop app
// can mirror them into its own local tracking without the portal ever writing directly
// into the desktop's database.
router.get('/submissions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM homework_submissions').all()
  res.json(
    rows.map((r) => ({
      homeworkAssignmentId: r.homework_assignment_id,
      studentId: r.student_id,
      status: r.status,
      submittedAt: r.submitted_at,
      textAnswer: r.text_answer,
      fileName: r.file_name,
      grade: r.grade,
      feedback: r.feedback
    }))
  )
})

// The teacher's desktop app downloading a student's submitted file — authenticated
// with the sync secret, same as every other route in this file, since the teacher has
// no Portal browser session of their own.
router.get('/submissions/:homeworkId/:studentId/file', (req, res) => {
  const submission = db
    .prepare(
      'SELECT * FROM homework_submissions WHERE homework_assignment_id = ? AND student_id = ?'
    )
    .get(req.params.homeworkId, req.params.studentId)
  if (!submission || !submission.file_path) return res.status(404).json({ error: 'No file' })
  res.download(path.join(SUBMISSIONS_DIR, submission.file_path), submission.file_name)
})

// Teacher pushes grades/feedback down from the desktop app — the one place a teacher's
// edits flow back to the Portal, separate from the wholesale replace at POST /.
router.post('/submissions/grade', (req, res) => {
  const { grades = [] } = req.body
  const now = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO homework_submissions
      (homework_assignment_id, student_id, status, updated_at, grade, feedback, graded_at)
    VALUES (@homeworkAssignmentId, @studentId, 'done', @now, @grade, @feedback, @now)
    ON CONFLICT(homework_assignment_id, student_id) DO UPDATE
      SET status = 'done', updated_at = @now, grade = @grade, feedback = @feedback, graded_at = @now
  `)
  const run = db.transaction(() => {
    for (const g of grades) {
      upsert.run({
        homeworkAssignmentId: g.homeworkAssignmentId,
        studentId: g.studentId,
        grade: g.grade ?? null,
        feedback: g.feedback ?? null,
        now
      })
    }
  })
  run()
  res.json({ ok: true })
})

// One row per family account, with its message thread and an unread count for
// messages the family sent — what the desktop app's Messages page lists as threads.
router.get('/messages/threads', (req, res) => {
  const accounts = db
    .prepare(
      `SELECT a.id, a.username, GROUP_CONCAT(s.first_name || ' ' || s.last_name, ', ') AS student_names
       FROM accounts a
       LEFT JOIN account_students acs ON acs.account_id = a.id
       LEFT JOIN students s ON s.id = acs.student_id
       GROUP BY a.id`
    )
    .all()

  const threads = accounts
    .map((a) => {
      const messages = db
        .prepare('SELECT * FROM messages WHERE account_id = ? ORDER BY created_at')
        .all(a.id)
      const unread = messages.filter((m) => m.sender === 'family' && !m.read_by_teacher).length
      return {
        accountId: a.id,
        username: a.username,
        studentNames: a.student_names,
        unread,
        messages: messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          body: m.body,
          createdAt: m.created_at
        }))
      }
    })
    .filter((t) => t.messages.length > 0 || t.unread > 0)

  res.json(threads)
})

router.post('/messages', (req, res) => {
  const { accountId, body } = req.body
  const text = (body || '').trim()
  if (!accountId || !text) return res.status(400).json({ error: 'accountId and body required' })
  db.prepare(
    'INSERT INTO messages (id, account_id, sender, body, created_at, read_by_family) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(crypto.randomUUID(), accountId, 'teacher', text, new Date().toISOString())
  res.json({ ok: true })
})

router.post('/messages/:accountId/read', (req, res) => {
  db.prepare('UPDATE messages SET read_by_teacher = 1 WHERE account_id = ? AND sender = ?').run(
    req.params.accountId,
    'family'
  )
  res.json({ ok: true })
})

// Teacher-triggered password reset (see portal/README.md — there is deliberately no
// self-service email reset; the teacher does this from the desktop app when a family
// says they're locked out, same day, not an async support queue).
router.post('/reset-password', (req, res) => {
  const { username, newPassword } = req.body
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'username and newPassword are required' })
  }
  const account = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username)
  if (!account) return res.status(404).json({ error: 'No such account' })
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword),
    account.id
  )
  res.json({ ok: true })
})

module.exports = router
