const express = require('express')
const crypto = require('crypto')
const db = require('../db')
const { hashPassword, issueSessionCookie } = require('../auth')

const router = express.Router()

function getValidInvite(code) {
  const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(code)
  if (!invite || invite.revoked || invite.claimed_at) return null
  return invite
}

// Revealing a class's roster names requires already holding a valid, unclaimed code —
// the code itself is the secret gate here. Knowing a classmate's name from this isn't
// enough to claim their account: redemption below also requires their date of birth.
router.get('/:code', (req, res) => {
  const invite = getValidInvite(req.params.code)
  if (!invite) return res.status(404).json({ error: 'Invalid or already-used code' })

  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(invite.class_id)
  const roster = db
    .prepare(
      `SELECT s.id, s.first_name, s.last_name FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.class_id = ? AND e.status = 'active'
       ORDER BY s.last_name, s.first_name`
    )
    .all(invite.class_id)

  res.json({
    className: cls?.name ?? 'Class',
    students: roster.map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))
  })
})

router.post('/:code/redeem', (req, res) => {
  const invite = getValidInvite(req.params.code)
  if (!invite) return res.status(404).json({ error: 'Invalid or already-used code' })

  const { studentId, dateOfBirth, username, password } = req.body
  if (!studentId || !dateOfBirth || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  const enrolled = db
    .prepare(
      "SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'"
    )
    .get(studentId, invite.class_id)
  if (!enrolled) return res.status(400).json({ error: 'Not a student in this class' })

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
  if (!student || student.date_of_birth !== dateOfBirth) {
    return res.status(400).json({ error: 'Date of birth does not match our records' })
  }

  const existing = db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username)
  if (existing) return res.status(400).json({ error: 'That username is taken' })

  const accountId = crypto.randomUUID()
  const now = new Date().toISOString()
  const run = db.transaction(() => {
    db.prepare(
      'INSERT INTO accounts (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(accountId, username, hashPassword(password), now)
    db.prepare('INSERT INTO account_students (account_id, student_id) VALUES (?, ?)').run(
      accountId,
      studentId
    )
    db.prepare('UPDATE invites SET claimed_at = ? WHERE code = ?').run(now, invite.code)
  })
  run()

  issueSessionCookie(res, accountId)
  res.json({ ok: true })
})

module.exports = router
