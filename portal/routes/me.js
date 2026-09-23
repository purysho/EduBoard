const express = require('express')
const crypto = require('crypto')
const path = require('path')
const QRCode = require('qrcode')
const db = require('../db')
const { requireAuth, newRandomToken, hashToken } = require('../auth')

const router = express.Router()
router.use(requireAuth)

const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'homework-uploads')
const SUBMISSIONS_DIR = path.join(__dirname, '..', 'data', 'submission-uploads')
require('fs').mkdirSync(SUBMISSIONS_DIR, { recursive: true })

function sanitizeFileName(name) {
  return String(name).replace(/[^\w.\-]+/g, '_').slice(-120)
}

// A family account covers one student today (redemption links exactly one), but the
// schema allows more than one row per account so a future "second child" invite could
// link into the same login without a schema change.
function getLinkedStudentIds(accountId) {
  return db
    .prepare('SELECT student_id FROM account_students WHERE account_id = ?')
    .all(accountId)
    .map((r) => r.student_id)
}

router.get('/', (req, res) => {
  const studentIds = getLinkedStudentIds(req.accountId)
  if (!studentIds.length) return res.json({ students: [] })

  const students = studentIds.map((studentId) => {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
    const classes = db
      .prepare(
        `SELECT c.id, c.name, c.level_type, g.percent, g.letter, g.attendance_rate
         FROM enrollments e
         JOIN classes c ON c.id = e.class_id
         LEFT JOIN grades g ON g.student_id = e.student_id AND g.class_id = e.class_id
         WHERE e.student_id = ? AND e.status = 'active'`
      )
      .all(studentId)
      .map((c) => {
        const homework = db
          .prepare('SELECT * FROM homework_assignments WHERE class_id = ? ORDER BY due_date')
          .all(c.id)
          .map((h) => {
            const submission = db
              .prepare(
                'SELECT * FROM homework_submissions WHERE homework_assignment_id = ? AND student_id = ?'
              )
              .get(h.id, studentId)
            return {
              id: h.id,
              title: h.title,
              description: h.description,
              dueDate: h.due_date,
              fileName: h.file_name,
              status: submission?.status ?? 'not_started',
              textAnswer: submission?.text_answer ?? null,
              submissionFileName: submission?.file_name ?? null,
              grade: submission?.grade ?? null,
              feedback: submission?.feedback ?? null
            }
          })

        return {
          id: c.id,
          name: c.name,
          levelType: c.level_type,
          percent: c.percent,
          letter: c.letter,
          attendanceRate: c.attendance_rate,
          homework
        }
      })
    return {
      studentId,
      studentName: `${student.first_name} ${student.last_name}`,
      classes
    }
  })

  res.json({ students })
})

// Gated on the requesting account actually having a linked student enrolled in this
// assignment's class — the session cookie alone isn't enough, since one account could
// otherwise fetch another class's attachment just by guessing/incrementing an id.
router.get('/homework/:id/file', (req, res) => {
  const hw = db.prepare('SELECT * FROM homework_assignments WHERE id = ?').get(req.params.id)
  if (!hw || !hw.file_path) return res.status(404).json({ error: 'No file' })

  const linked = getLinkedStudentIds(req.accountId)
  const enrolled = linked.some((studentId) =>
    db
      .prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'")
      .get(studentId, hw.class_id)
  )
  if (!enrolled) return res.status(403).json({ error: 'Not your class' })

  res.download(path.join(UPLOADS_DIR, hw.file_path), hw.file_name)
})

// A student turns in their work here — text, a file, or both. Grading (setting
// status='done', grade, feedback) is teacher-only and happens from the desktop app,
// pushed back up via /api/sync/submissions/grade — a student can never mark their own
// work as graded.
router.post('/homework/:id/submit', (req, res) => {
  const { studentId, textAnswer, fileName, fileData } = req.body
  if (!studentId || !getLinkedStudentIds(req.accountId).includes(studentId)) {
    return res.status(403).json({ error: 'Not your student' })
  }
  if (!textAnswer && !fileData) {
    return res.status(400).json({ error: 'Add some text or a file before submitting' })
  }

  const hw = db.prepare('SELECT class_id FROM homework_assignments WHERE id = ?').get(
    req.params.id
  )
  if (!hw) return res.status(404).json({ error: 'Assignment not found' })
  const enrolled = db
    .prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'")
    .get(studentId, hw.class_id)
  if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this class' })

  let storedFileName = null
  let storedFilePath = null
  if (fileName && fileData) {
    storedFileName = fileName
    const storedName = `${req.params.id}-${studentId}-${sanitizeFileName(fileName)}`
    require('fs').writeFileSync(
      path.join(SUBMISSIONS_DIR, storedName),
      Buffer.from(fileData, 'base64')
    )
    storedFilePath = storedName
  }

  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO homework_submissions
       (homework_assignment_id, student_id, status, submitted_at, updated_at, text_answer, file_name, file_path)
     VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?)
     ON CONFLICT(homework_assignment_id, student_id) DO UPDATE
       SET status = 'submitted', submitted_at = ?, updated_at = ?, text_answer = ?, file_name = ?, file_path = ?`
  ).run(
    req.params.id,
    studentId,
    now,
    now,
    textAnswer || null,
    storedFileName,
    storedFilePath,
    now,
    now,
    textAnswer || null,
    storedFileName,
    storedFilePath
  )
  res.json({ ok: true })
})

// A student re-downloading what they themselves already turned in.
router.get('/homework/:id/submission-file', (req, res) => {
  const { studentId } = req.query
  if (!studentId || !getLinkedStudentIds(req.accountId).includes(studentId)) {
    return res.status(403).json({ error: 'Not your student' })
  }
  const submission = db
    .prepare(
      'SELECT * FROM homework_submissions WHERE homework_assignment_id = ? AND student_id = ?'
    )
    .get(req.params.id, studentId)
  if (!submission || !submission.file_path) return res.status(404).json({ error: 'No file' })
  res.download(path.join(SUBMISSIONS_DIR, submission.file_path), submission.file_name)
})

const POSTS_DIR = path.join(__dirname, '..', 'data', 'post-images')
require('fs').mkdirSync(POSTS_DIR, { recursive: true })

// Every post from every class this account's student(s) are actively enrolled in,
// newest first — a family with two kids in different classes sees one combined feed.
router.get('/posts', (req, res) => {
  const studentIds = getLinkedStudentIds(req.accountId)
  if (!studentIds.length) return res.json([])

  const classIds = new Set()
  for (const studentId of studentIds) {
    db.prepare("SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active'")
      .all(studentId)
      .forEach((r) => classIds.add(r.class_id))
  }
  if (!classIds.size) return res.json([])

  const placeholders = [...classIds].map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS class_name FROM class_posts p
       JOIN classes c ON c.id = p.class_id
       WHERE p.class_id IN (${placeholders})
       ORDER BY p.created_at DESC`
    )
    .all(...classIds)

  res.json(
    rows.map((r) => ({
      id: r.id,
      className: r.class_name,
      body: r.body,
      hasImage: !!r.image_path,
      createdAt: r.created_at
    }))
  )
})

router.get('/posts/:id/image', (req, res) => {
  const studentIds = getLinkedStudentIds(req.accountId)
  const post = db.prepare('SELECT * FROM class_posts WHERE id = ?').get(req.params.id)
  if (!post || !post.image_path) return res.status(404).json({ error: 'No image' })
  const enrolled = studentIds.some((studentId) =>
    db
      .prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'")
      .get(studentId, post.class_id)
  )
  if (!enrolled) return res.status(403).json({ error: 'Not your class' })
  res.sendFile(path.join(POSTS_DIR, post.image_path))
})

// One thread per account with the teacher — reading it marks the teacher's messages
// read so the family's unread badge clears; the teacher's own unread count (for
// messages the family sent) is a separate flag, cleared from the desktop app instead.
router.get('/messages', (req, res) => {
  db.prepare('UPDATE messages SET read_by_family = 1 WHERE account_id = ? AND sender = ?').run(
    req.accountId,
    'teacher'
  )
  const rows = db
    .prepare('SELECT * FROM messages WHERE account_id = ? ORDER BY created_at')
    .all(req.accountId)
  res.json(
    rows.map((r) => ({ id: r.id, sender: r.sender, body: r.body, createdAt: r.created_at }))
  )
})

router.post('/messages', (req, res) => {
  const body = (req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: 'Message is empty' })
  db.prepare(
    'INSERT INTO messages (id, account_id, sender, body, created_at, read_by_teacher) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(crypto.randomUUID(), req.accountId, 'family', body, new Date().toISOString())
  res.json({ ok: true })
})

// Issues a fresh, independent quick-login token and returns it as a downloadable QR
// image — the raw token is shown/embedded exactly once, here; only its hash is stored.
router.post('/qr', async (req, res) => {
  const token = newRandomToken()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO qr_tokens (id, account_id, token_hash, label, revoked, created_at) VALUES (?, ?, ?, ?, 0, ?)'
  ).run(id, req.accountId, hashToken(token), req.body?.label || null, new Date().toISOString())

  const loginUrl = `${req.protocol}://${req.get('host')}/api/auth/qr-login?token=${token}`
  const qrDataUrl = await QRCode.toDataURL(loginUrl)
  res.json({ id, qrDataUrl })
})

router.get('/qr', (req, res) => {
  const tokens = db
    .prepare('SELECT id, label, revoked, created_at FROM qr_tokens WHERE account_id = ?')
    .all(req.accountId)
  res.json(tokens)
})

router.delete('/qr/:id', (req, res) => {
  db.prepare('UPDATE qr_tokens SET revoked = 1 WHERE id = ? AND account_id = ?').run(
    req.params.id,
    req.accountId
  )
  res.json({ ok: true })
})

module.exports = router
