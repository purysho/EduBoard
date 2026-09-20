const express = require('express')
const crypto = require('crypto')
const QRCode = require('qrcode')
const db = require('../db')
const { requireAuth, newRandomToken, hashToken } = require('../auth')

const router = express.Router()
router.use(requireAuth)

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
        const homework =
          c.level_type === 'university'
            ? db
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
                    status: submission?.status ?? 'not_started'
                  }
                })
            : null

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

router.post('/homework/:id/status', (req, res) => {
  const { status, studentId } = req.body
  if (!['not_started', 'submitted', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  if (!getLinkedStudentIds(req.accountId).includes(studentId)) {
    return res.status(403).json({ error: 'Not your student' })
  }

  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO homework_submissions (homework_assignment_id, student_id, status, submitted_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(homework_assignment_id, student_id) DO UPDATE SET status = ?, submitted_at = ?, updated_at = ?`
  ).run(
    req.params.id,
    studentId,
    status,
    status === 'not_started' ? null : now,
    now,
    status,
    status === 'not_started' ? null : now,
    now
  )
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
