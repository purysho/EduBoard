const express = require('express')
const crypto = require('crypto')
const db = require('../db')
const { hashPassword, issueSessionCookie, passwordProblem } = require('../auth')
const { rateLimit, LIMITS } = require('../rateLimit')

// Three kinds of invite code, all published from the teacher's desktop app:
//
// - 'student': a personal link for one student on the roster. It opens "Hi MaiMai" and
//   can be used once.
// - 'class_link': one reusable link per class. Whoever opens it types their own name and
//   is added to the class (or matched to their place on the roster, see joinClass). The
//   teacher can turn it off or reset it from the desktop app.
// - no kind: the older printed strips. Single-use, and now also a fill-in form.
//
// None of them shows who else is in the class. The older strips used to list the whole
// roster to anyone holding a code.

const router = express.Router()
// A code in the URL is what lets someone in, so guessing codes (and creating accounts
// with a shared class link) must be slow.
router.use(rateLimit(LIMITS.secretUrlPerIp))

function getValidInvite(code) {
  const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(code)
  if (!invite || invite.revoked) return null
  // A class link is reusable; every other kind works once.
  if (invite.kind !== 'class_link' && invite.claimed_at) return null
  // Nobody joins a class that has finished.
  if (db.prepare('SELECT finished FROM classes WHERE id = ?').get(invite.class_id)?.finished) {
    return null
  }
  return invite
}

const normalizeName = (s) =>
  String(s || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

const hasAccount = (studentId) =>
  !!db.prepare('SELECT 1 FROM account_students WHERE student_id = ?').get(studentId)

const isRealDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCDate() === +m[3] && d.getTime() < Date.now()
}

router.get('/:code', (req, res) => {
  const invite = getValidInvite(req.params.code)
  if (!invite) return res.status(404).json({ error: 'Invalid or already-used code' })
  const cls = db.prepare('SELECT name FROM classes WHERE id = ?').get(invite.class_id)

  if (invite.kind === 'student') {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(invite.student_id)
    if (!student || hasAccount(student.id)) {
      return res.status(404).json({ error: 'Invalid or already-used code' })
    }
    return res.json({
      kind: 'student',
      className: cls?.name ?? 'Class',
      firstName: student.first_name,
      hasDob: Boolean(student.date_of_birth)
    })
  }
  // A class link or an older strip: a form to fill in, never a list of names.
  res.json({ kind: 'class', className: cls?.name ?? 'Class' })
})

function validateCredentials(username, password) {
  if (typeof username !== 'string' || username.trim().length < 3 || username.length > 40) {
    return 'Username must be 3–40 characters'
  }
  const problem = passwordProblem(password)
  if (problem) return problem
  if (db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username.trim())) {
    return 'That username is taken'
  }
  return null
}

/** The date-of-birth check that stops one student claiming another's place: when the
 * teacher has a date on file it must match; when not, the one entered is recorded. */
function checkDob(student, dateOfBirth) {
  if (student.date_of_birth) {
    return student.date_of_birth === dateOfBirth ? null : 'Date of birth does not match our records'
  }
  if (isRealDate(dateOfBirth)) {
    db.prepare('UPDATE students SET date_of_birth = ? WHERE id = ?').run(dateOfBirth, student.id)
  }
  return null
}

function createAccount(res, { username, password, studentId, inviteCode, markClaimed }) {
  const accountId = crypto.randomUUID()
  const now = new Date().toISOString()
  db.transaction(() => {
    db.prepare(
      'INSERT INTO accounts (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(accountId, username.trim(), hashPassword(password), now)
    db.prepare('INSERT INTO account_students (account_id, student_id) VALUES (?, ?)').run(
      accountId,
      studentId
    )
    if (markClaimed) {
      db.prepare('UPDATE invites SET claimed_at = ? WHERE code = ?').run(now, inviteCode)
    }
  })()
  issueSessionCookie(res, accountId)
  res.json({ ok: true })
}

/**
 * Someone joining a class with their own details. If they're already on the roster
 * (same name, no account yet) they're matched to that place, so their grades and work
 * are theirs; if the teacher recorded a birth date for that student, it must match.
 * Otherwise they're added to the class as a new student, which the teacher's desktop
 * app picks up on its next sync.
 */
function joinClass(invite, body) {
  const firstName = String(body.firstName || '')
    .trim()
    .slice(0, 60)
  const lastName = String(body.lastName || '')
    .trim()
    .slice(0, 60)
  if (!firstName || !lastName) return { error: 'Please enter your first and last name' }
  if (!isRealDate(body.dateOfBirth)) return { error: 'Please enter your date of birth' }

  const wanted = normalizeName(`${firstName} ${lastName}`)
  const sameName = db
    .prepare(
      `SELECT s.* FROM students s JOIN enrollments e ON e.student_id = s.id
       WHERE e.class_id = ? AND e.status = 'active'`
    )
    .all(invite.class_id)
    .filter((s) => normalizeName(`${s.first_name} ${s.last_name}`) === wanted)
    .filter((s) => !hasAccount(s.id))
  if (sameName.length === 1) {
    const problem = checkDob(sameName[0], body.dateOfBirth)
    return problem ? { error: problem } : { studentId: sameName[0].id }
  }

  const cls = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(invite.class_id)
  if (!cls) return { error: 'Invalid or already-used code' }
  const studentId = crypto.randomUUID()
  const now = new Date().toISOString()
  db.transaction(() => {
    db.prepare(
      `INSERT INTO students (id, teacher_id, first_name, last_name, date_of_birth, origin, joined_at)
       VALUES (?, ?, ?, ?, ?, 'portal', ?)`
    ).run(studentId, cls.teacher_id, firstName, lastName, body.dateOfBirth, now)
    db.prepare(
      `INSERT INTO enrollments (student_id, class_id, status, origin) VALUES (?, ?, 'active', 'portal')`
    ).run(studentId, invite.class_id)
  })()
  return { studentId }
}

router.post('/:code/redeem', (req, res) => {
  const invite = getValidInvite(req.params.code)
  if (!invite) return res.status(404).json({ error: 'Invalid or already-used code' })
  const body = req.body || {}
  const { username, password, dateOfBirth } = body
  if (!username || !password) return res.status(400).json({ error: 'All fields are required' })
  const credentialProblem = validateCredentials(username, password)
  if (credentialProblem) return res.status(400).json({ error: credentialProblem })

  // A personal link: the student is fixed by the invite, not by anything sent.
  if (invite.kind === 'student') {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(invite.student_id)
    if (!student || hasAccount(student.id)) {
      return res.status(404).json({ error: 'Invalid or already-used code' })
    }
    const problem = checkDob(student, dateOfBirth)
    if (problem) return res.status(400).json({ error: problem })
    return createAccount(res, {
      username,
      password,
      studentId: student.id,
      inviteCode: invite.code,
      markClaimed: true
    })
  }

  // An older strip redeemed the old way, naming a student id from the class (kept so
  // anything already in flight still works; ids are never shown to anyone now).
  if (!invite.kind && body.studentId) {
    const enrolled = db
      .prepare(
        "SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'"
      )
      .get(body.studentId, invite.class_id)
    const student =
      enrolled && db.prepare('SELECT * FROM students WHERE id = ?').get(body.studentId)
    if (!student) return res.status(400).json({ error: 'Not a student in this class' })
    const problem = checkDob(student, dateOfBirth)
    if (problem) return res.status(400).json({ error: problem })
    return createAccount(res, {
      username,
      password,
      studentId: student.id,
      inviteCode: invite.code,
      markClaimed: true
    })
  }

  const joined = joinClass(invite, body)
  if (joined.error) return res.status(400).json({ error: joined.error })
  createAccount(res, {
    username,
    password,
    studentId: joined.studentId,
    inviteCode: invite.code,
    markClaimed: invite.kind !== 'class_link'
  })
})

module.exports = router
