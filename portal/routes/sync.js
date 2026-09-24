const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../db')
const { requireSyncSecret, hashPassword } = require('../auth')
const { saveAiSettings } = require('../services/ai')
const { saveDigestSettings } = require('../services/mailer')
const { sendAllDigests } = require('../services/digest')

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
    invites = [],
    materials = [],
    aiProvider,
    aiApiKey,
    aiCustomBaseUrl,
    aiCustomModel,
    digestEnabled,
    digestSmtpHost,
    digestSmtpPort,
    digestSmtpUser,
    digestSmtpPass,
    digestFromEmail,
    digestFromName
  } = req.body

  // KNOWN LIMITATION (multi-teacher): the AI key and digest SMTP config are still a
  // single shared row (ai_settings/digest_settings, id=1), not scoped per teacher_id
  // like classes/students/homework above — whichever teacher publishes last sets it for
  // every teacher on this Portal. Fine for a single-teacher deployment; a school
  // deployment with several teachers wanting their own AI key or sender address needs
  // these two tables made per-teacher before that's safe to rely on.
  saveAiSettings({
    provider: aiProvider,
    apiKey: aiApiKey,
    customBaseUrl: aiCustomBaseUrl,
    customModel: aiCustomModel
  })
  saveDigestSettings({
    enabled: digestEnabled,
    smtpHost: digestSmtpHost,
    smtpPort: digestSmtpPort,
    smtpUser: digestSmtpUser,
    smtpPass: digestSmtpPass,
    fromEmail: digestFromEmail,
    fromName: digestFromName
  })

  // Every publish replaces the whole homework_assignments table (see below), so old
  // attachment files would otherwise pile up on disk forever — clear the folder first
  // and let this push repopulate only what's still current.
  for (const entry of fs.readdirSync(UPLOADS_DIR)) {
    fs.rmSync(path.join(UPLOADS_DIR, entry), { force: true })
  }

  const teacherId = req.teacherId

  const run = db.transaction(() => {
    // Every DELETE here is scoped to this teacher's own classIds/rows — critical in a
    // multi-teacher Portal, since a wholesale "replace everything" push must never
    // touch another teacher's roster just because they happen to share this server.
    const ownClassIds = db
      .prepare('SELECT id FROM classes WHERE teacher_id = ?')
      .all(teacherId)
      .map((r) => r.id)
    const classIdPlaceholders = ownClassIds.map(() => '?').join(',') || 'NULL'

    db.prepare('DELETE FROM classes WHERE teacher_id = ?').run(teacherId)
    db.prepare('DELETE FROM students WHERE teacher_id = ?').run(teacherId)
    if (ownClassIds.length) {
      db.prepare(`DELETE FROM enrollments WHERE class_id IN (${classIdPlaceholders})`).run(
        ...ownClassIds
      )
      db.prepare(`DELETE FROM grades WHERE class_id IN (${classIdPlaceholders})`).run(
        ...ownClassIds
      )
      db.prepare(
        `DELETE FROM homework_questions WHERE homework_assignment_id IN
           (SELECT id FROM homework_assignments WHERE class_id IN (${classIdPlaceholders}))`
      ).run(...ownClassIds)
      db.prepare(`DELETE FROM homework_assignments WHERE class_id IN (${classIdPlaceholders})`).run(
        ...ownClassIds
      )
      db.prepare(
        `DELETE FROM material_chunks WHERE material_id IN
           (SELECT id FROM materials WHERE class_id IN (${classIdPlaceholders}))`
      ).run(...ownClassIds)
      db.prepare(`DELETE FROM materials WHERE class_id IN (${classIdPlaceholders})`).run(
        ...ownClassIds
      )
    }

    const insertClass = db.prepare(
      'INSERT INTO classes (id, teacher_id, name, level_type) VALUES (?, ?, ?, ?)'
    )
    for (const c of classes) insertClass.run(c.id, teacherId, c.name, c.levelType)

    const insertStudent = db.prepare(
      'INSERT INTO students (id, teacher_id, first_name, last_name, date_of_birth, student_number) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const s of students) {
      insertStudent.run(s.id, teacherId, s.firstName, s.lastName, s.dateOfBirth, s.studentNumber)
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
      'INSERT INTO homework_assignments (id, class_id, title, description, due_date, file_name, file_path, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const insertQuestion = db.prepare(
      `INSERT INTO homework_questions
         (id, homework_assignment_id, type, prompt, options, correct_answer, points, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const h of homeworkAssignments) {
      let filePath = null
      if (h.fileName && h.fileData) {
        const storedName = `${h.id}-${sanitizeFileName(h.fileName)}`
        fs.writeFileSync(path.join(UPLOADS_DIR, storedName), Buffer.from(h.fileData, 'base64'))
        filePath = storedName
      }
      insertHomework.run(
        h.id,
        h.classId,
        h.title,
        h.description,
        h.dueDate,
        h.fileName,
        filePath,
        h.topic || null
      )
      ;(h.questions || []).forEach((q, i) => {
        insertQuestion.run(
          crypto.randomUUID(),
          h.id,
          q.type,
          q.prompt,
          q.options ? JSON.stringify(q.options) : null,
          q.correctAnswer,
          q.points,
          i
        )
      })
    }

    const insertMaterial = db.prepare(
      'INSERT INTO materials (id, class_id, title, study_guide) VALUES (?, ?, ?, ?)'
    )
    const insertChunk = db.prepare(
      'INSERT INTO material_chunks (material_id, chunk_index, text) VALUES (?, ?, ?)'
    )
    for (const m of materials) {
      insertMaterial.run(m.id, m.classId, m.title, m.studyGuide || null)
      ;(m.chunks || []).forEach((text, i) => insertChunk.run(m.id, i, text))
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

// True for a homework assignment that belongs to one of this teacher's own classes —
// checked before any submission-grading action touches it, so a valid sync secret for
// teacher A can never read or grade teacher B's students' work.
function ownsAssignment(teacherId, homeworkAssignmentId) {
  return !!db
    .prepare(
      `SELECT 1 FROM homework_assignments h
       JOIN classes c ON c.id = h.class_id
       WHERE h.id = ? AND c.teacher_id = ?`
    )
    .get(homeworkAssignmentId, teacherId)
}

// Pull homework submission statuses students have set themselves, so the desktop app
// can mirror them into its own local tracking without the portal ever writing directly
// into the desktop's database.
router.get('/submissions', (req, res) => {
  const rows = db
    .prepare(
      `SELECT sub.* FROM homework_submissions sub
       JOIN homework_assignments h ON h.id = sub.homework_assignment_id
       JOIN classes c ON c.id = h.class_id
       WHERE c.teacher_id = ?`
    )
    .all(req.teacherId)
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

// Teacher stars/unstars a graded submission for the student's Portfolio — pushed
// immediately, same pattern as /submissions/grade.
router.post('/submissions/portfolio', (req, res) => {
  const { homeworkAssignmentId, studentId, portfolio } = req.body
  if (!homeworkAssignmentId || !studentId) {
    return res.status(400).json({ error: 'homeworkAssignmentId and studentId required' })
  }
  if (!ownsAssignment(req.teacherId, homeworkAssignmentId)) {
    return res.status(404).json({ error: 'Assignment not found' })
  }
  db.prepare(
    `UPDATE homework_submissions SET portfolio = ?, updated_at = ?
     WHERE homework_assignment_id = ? AND student_id = ?`
  ).run(portfolio ? 1 : 0, new Date().toISOString(), homeworkAssignmentId, studentId)
  res.json({ ok: true })
})

// The teacher's desktop app downloading a student's submitted file — authenticated
// with the sync secret, same as every other route in this file, since the teacher has
// no Portal browser session of their own.
router.get('/submissions/:homeworkId/:studentId/file', (req, res) => {
  if (!ownsAssignment(req.teacherId, req.params.homeworkId)) {
    return res.status(404).json({ error: 'Not found' })
  }
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
      if (!ownsAssignment(req.teacherId, g.homeworkAssignmentId)) continue
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

const POSTS_DIR = path.join(__dirname, '..', 'data', 'post-images')
fs.mkdirSync(POSTS_DIR, { recursive: true })

function ownsClass(teacherId, classId) {
  return !!db
    .prepare('SELECT 1 FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, teacherId)
}

router.get('/posts', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.* FROM class_posts p
       JOIN classes c ON c.id = p.class_id
       WHERE c.teacher_id = ? ORDER BY p.created_at DESC`
    )
    .all(req.teacherId)
  res.json(
    rows.map((r) => ({
      id: r.id,
      classId: r.class_id,
      body: r.body,
      hasImage: !!r.image_path,
      createdAt: r.created_at
    }))
  )
})

router.post('/posts', (req, res) => {
  const { classId, body, imageName, imageData } = req.body
  const text = (body || '').trim()
  if (!classId || !text) return res.status(400).json({ error: 'classId and body required' })
  if (!ownsClass(req.teacherId, classId)) return res.status(404).json({ error: 'Class not found' })

  let imagePath = null
  if (imageName && imageData) {
    const id = crypto.randomUUID()
    const storedName = `${id}-${sanitizeFileName(imageName)}`
    fs.writeFileSync(path.join(POSTS_DIR, storedName), Buffer.from(imageData, 'base64'))
    imagePath = storedName
    db.prepare(
      'INSERT INTO class_posts (id, class_id, body, image_name, image_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, classId, text, imageName, imagePath, new Date().toISOString())
    return res.json({ ok: true })
  }

  db.prepare(
    'INSERT INTO class_posts (id, class_id, body, created_at) VALUES (?, ?, ?, ?)'
  ).run(crypto.randomUUID(), classId, text, new Date().toISOString())
  res.json({ ok: true })
})

router.delete('/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM class_posts WHERE id = ?').get(req.params.id)
  if (!post || !ownsClass(req.teacherId, post.class_id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  if (post?.image_path) fs.rmSync(path.join(POSTS_DIR, post.image_path), { force: true })
  db.prepare('DELETE FROM class_posts WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// One row per family account, with its message thread and an unread count for
// messages the family sent — what the desktop app's Messages page lists as threads.
// Scoped to accounts with at least one student belonging to this teacher — messages
// themselves aren't partitioned per-teacher (a family with children taught by two
// different teachers on the same Portal would see one merged thread either way, a rare
// edge case this simpler model accepts), but a teacher can never see a family who has
// no relation to them at all.
router.get('/messages/threads', (req, res) => {
  const accounts = db
    .prepare(
      `SELECT a.id, a.username, GROUP_CONCAT(s.first_name || ' ' || s.last_name, ', ') AS student_names
       FROM accounts a
       JOIN account_students acs ON acs.account_id = a.id
       JOIN students s ON s.id = acs.student_id
       WHERE a.id IN (
         SELECT acs2.account_id FROM account_students acs2
         JOIN students s2 ON s2.id = acs2.student_id
         WHERE s2.teacher_id = ?
       )
       GROUP BY a.id`
    )
    .all(req.teacherId)

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

function ownsAccount(teacherId, accountId) {
  return !!db
    .prepare(
      `SELECT 1 FROM account_students acs
       JOIN students s ON s.id = acs.student_id
       WHERE acs.account_id = ? AND s.teacher_id = ?`
    )
    .get(accountId, teacherId)
}

router.post('/messages', (req, res) => {
  const { accountId, body } = req.body
  const text = (body || '').trim()
  if (!accountId || !text) return res.status(400).json({ error: 'accountId and body required' })
  if (!ownsAccount(req.teacherId, accountId)) return res.status(404).json({ error: 'Not found' })
  db.prepare(
    'INSERT INTO messages (id, account_id, sender, body, created_at, read_by_family) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(crypto.randomUUID(), accountId, 'teacher', text, new Date().toISOString())
  res.json({ ok: true })
})

router.post('/messages/:accountId/read', (req, res) => {
  if (!ownsAccount(req.teacherId, req.params.accountId)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('UPDATE messages SET read_by_teacher = 1 WHERE account_id = ? AND sender = ?').run(
    req.params.accountId,
    'family'
  )
  res.json({ ok: true })
})

// Teacher-triggered immediate send, for testing or an out-of-cycle update — the
// automatic weekly send (see services/digest.runScheduledDigestIfDue) still runs
// independently on its own Monday-morning schedule.
router.post('/digest/send-now', async (_req, res) => {
  try {
    const result = await sendAllDigests()
    res.json(result)
  } catch (err) {
    res.status(err.name === 'DigestNotConfiguredError' ? 503 : 500).json({ error: err.message })
  }
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
  if (!account || !ownsAccount(req.teacherId, account.id)) {
    return res.status(404).json({ error: 'No such account' })
  }
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword),
    account.id
  )
  res.json({ ok: true })
})

module.exports = router
