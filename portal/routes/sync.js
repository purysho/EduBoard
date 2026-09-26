const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../db')
const { requireSyncSecret, hashPassword, passwordProblem, revokeSessions } = require('../auth')
const { saveAiSettings, complete, AiNotConfiguredError } = require('../services/ai')
const { isLanguage, buildTranslationPrompt, cleanReply } = require('../services/translate')
const { aiUsageSummary, listInteractions } = require('../services/aiUsage')
const { saveDigestSettings } = require('../services/mailer')
const { sendAllDigests } = require('../services/digest')
const { isValidTimeZone } = require('../services/deadlines')
const { validateFlashcards, validatePracticeQuiz } = require('../services/practiceSets')
const { checkUpload } = require('../services/fileSafety')
const { toTeacherView } = require('../services/profile')
const { PROFILE_PHOTOS_DIR } = require('../paths')

// A practice set is stored only if it passes the same validation the desktop applies.
// Anything else is dropped (the material still publishes), since this is rendered to
// students and the payload's shape is never trusted.
function validatedJson(validate, value) {
  if (value == null) return null
  const result = validate(value)
  return result.ok ? JSON.stringify(result.value) : null
}

const router = express.Router()
router.use(requireSyncSecret)

const { UPLOADS_DIR, SUBMISSIONS_DIR, POSTS_DIR } = require('../paths')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true })

function sanitizeFileName(name) {
  return String(name)
    .replace(/[^\w.-]+/g, '_')
    .slice(-120)
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
    digestFromName,
    timeZone
  } = req.body

  // The teacher's own IANA time zone, which decides when a due date ends (see
  // services/deadlines.js). An unrecognised value is ignored, never stored.
  if (isValidTimeZone(timeZone)) {
    db.prepare('UPDATE teachers SET timezone = ? WHERE id = ?').run(timeZone, req.teacherId)
  }

  // Each teacher's AI key and digest SMTP config is their own row, scoped by
  // req.teacherId — one teacher's publish never overwrites another's settings.
  saveAiSettings(req.teacherId, {
    provider: aiProvider,
    apiKey: aiApiKey,
    customBaseUrl: aiCustomBaseUrl,
    customModel: aiCustomModel
  })
  saveDigestSettings(req.teacherId, {
    enabled: digestEnabled,
    smtpHost: digestSmtpHost,
    smtpPort: digestSmtpPort,
    smtpUser: digestSmtpUser,
    smtpPass: digestSmtpPass,
    fromEmail: digestFromEmail,
    fromName: digestFromName
  })

  const teacherId = req.teacherId

  // Only rows for classes in this same push are accepted. Every class below is inserted
  // under this teacher (and a class id another teacher already owns fails the insert),
  // so this is what stops a push from writing into someone else's class — and it keeps
  // rows for a class the desktop no longer sends (e.g. a material still shared to an
  // archived class) from being inserted where the scoped DELETEs below can never reach
  // them, which made every later publish fail on a duplicate id.
  const pushedClassIds = new Set(classes.map((c) => c.id))
  const pushedStudentIds = new Set(students.map((s) => s.id))
  const inPushedClass = (row) => pushedClassIds.has(row.classId)
  const inPushedRoster = (row) => inPushedClass(row) && pushedStudentIds.has(row.studentId)

  // Every publish replaces this teacher's homework_assignments (see below), so their old
  // attachment files would otherwise pile up on disk forever. The uploads folder is
  // shared by every teacher on this Portal, so only this teacher's own previous files
  // are candidates for removal — and only once the new push has committed.
  const previousHomework = db
    .prepare(
      `SELECT h.id, h.file_path, h.file_hash FROM homework_assignments h
       JOIN classes c ON c.id = h.class_id
       WHERE c.teacher_id = ?`
    )
    .all(teacherId)
  const previousFiles = previousHomework.map((r) => r.file_path).filter(Boolean)
  const previousFileById = new Map(previousHomework.map((r) => [r.id, r]))
  const writtenFiles = new Set()
  // Attachments and material text the publish described by fingerprint only, which the
  // desktop then uploads one at a time (POST /homework/:id/file, /materials/:id/chunks).
  // Sending them inside this one request made a publish with a few attachments too big
  // for the server to accept.
  const needFiles = []
  const needChunks = []

  // Material text whose fingerprint hasn't changed is carried over, not re-sent.
  const previousChunks = new Map()
  for (const m of db
    .prepare(
      `SELECT m.id, m.chunks_hash FROM materials m JOIN classes c ON c.id = m.class_id
       WHERE c.teacher_id = ? AND m.chunks_hash IS NOT NULL`
    )
    .all(teacherId)) {
    previousChunks.set(m.id, {
      hash: m.chunks_hash,
      texts: db
        .prepare('SELECT text FROM material_chunks WHERE material_id = ? ORDER BY chunk_index')
        .all(m.id)
        .map((r) => r.text)
    })
  }

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
    // Students who joined through a class link and haven't reached the desktop app yet
    // are kept (origin 'portal'); everything else is replaced by this push.
    db.prepare("DELETE FROM students WHERE teacher_id = ? AND origin != 'portal'").run(teacherId)
    if (ownClassIds.length) {
      db.prepare(
        `DELETE FROM enrollments WHERE class_id IN (${classIdPlaceholders}) AND origin != 'portal'`
      ).run(...ownClassIds)
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
    // Materials whose class no longer exists at all are unreachable (every read joins
    // classes) — older Portal versions left them behind for a resource still shared to an
    // archived class. Clearing them lets that class be published again without the
    // material's id colliding with its own orphaned row.
    db.prepare(
      `DELETE FROM material_chunks WHERE material_id IN
         (SELECT id FROM materials WHERE class_id NOT IN (SELECT id FROM classes))`
    ).run()
    db.prepare('DELETE FROM materials WHERE class_id NOT IN (SELECT id FROM classes)').run()

    const insertClass = db.prepare(
      'INSERT INTO classes (id, teacher_id, name, level_type) VALUES (?, ?, ?, ?)'
    )
    for (const c of classes) insertClass.run(c.id, teacherId, c.name, c.levelType)

    // A student the desktop now sends (including one that joined through a link and has
    // since been imported) becomes an ordinary desktop-owned student. Only this teacher's
    // own rows can be updated this way.
    const insertStudent = db.prepare(
      `INSERT INTO students (id, teacher_id, first_name, last_name, date_of_birth, student_number, origin)
       VALUES (?, ?, ?, ?, ?, ?, 'desktop')
       ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name,
         date_of_birth = excluded.date_of_birth, student_number = excluded.student_number, origin = 'desktop'
       WHERE students.teacher_id = excluded.teacher_id`
    )
    for (const s of students) {
      insertStudent.run(s.id, teacherId, s.firstName, s.lastName, s.dateOfBirth, s.studentNumber)
    }

    const insertEnrollment = db.prepare(
      "INSERT OR REPLACE INTO enrollments (student_id, class_id, status, origin) VALUES (?, ?, ?, 'desktop')"
    )
    for (const e of enrollments.filter(inPushedRoster)) {
      insertEnrollment.run(e.studentId, e.classId, e.status)
    }

    const insertGrade = db.prepare(
      'INSERT OR REPLACE INTO grades (student_id, class_id, percent, letter, attendance_rate) VALUES (?, ?, ?, ?, ?)'
    )
    for (const g of grades.filter(inPushedRoster)) {
      insertGrade.run(g.studentId, g.classId, g.percent, g.letter, g.attendanceRate)
    }

    const insertHomework = db.prepare(
      'INSERT INTO homework_assignments (id, class_id, title, description, due_date, file_name, file_path, topic, file_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const insertQuestion = db.prepare(
      `INSERT INTO homework_questions
         (id, homework_assignment_id, type, prompt, options, correct_answer, points, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const h of homeworkAssignments.filter(inPushedClass)) {
      let filePath = null
      let fileHash = null
      if (h.fileName && h.fileData) {
        // An older desktop app still sends the file inline.
        const bytes = Buffer.from(h.fileData, 'base64')
        const storedName = `${h.id}-${sanitizeFileName(h.fileName)}`
        fs.writeFileSync(path.join(UPLOADS_DIR, storedName), bytes)
        writtenFiles.add(storedName)
        filePath = storedName
        fileHash = crypto.createHash('sha256').update(bytes).digest('hex')
      } else if (h.fileName && isSha256(h.fileHash)) {
        fileHash = h.fileHash
        const previous = previousFileById.get(h.id)
        if (previous?.file_path && previous.file_hash === h.fileHash) {
          filePath = previous.file_path
          writtenFiles.add(filePath)
        } else {
          needFiles.push(h.id)
        }
      }
      insertHomework.run(
        h.id,
        h.classId,
        h.title,
        h.description,
        h.dueDate,
        h.fileName,
        filePath,
        h.topic || null,
        fileHash
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
      'INSERT INTO materials (id, class_id, title, study_guide, flashcards, practice_quiz, chunks_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    const insertChunk = db.prepare(
      'INSERT INTO material_chunks (material_id, chunk_index, text) VALUES (?, ?, ?)'
    )
    for (const m of materials.filter(inPushedClass)) {
      insertMaterial.run(
        m.id,
        m.classId,
        m.title,
        m.studyGuide || null,
        validatedJson(validateFlashcards, m.flashcards),
        validatedJson(validatePracticeQuiz, m.practiceQuiz),
        isSha256(m.chunksHash) ? m.chunksHash : null
      )
      if (Array.isArray(m.chunks)) {
        // An older desktop app sends the text inline.
        m.chunks.forEach((text, i) => insertChunk.run(m.id, i, String(text)))
      } else if (isSha256(m.chunksHash)) {
        const previous = previousChunks.get(m.id)
        // Only text that actually arrived counts: a material whose upload never
        // happened (or failed) is asked for again.
        if (previous?.hash === m.chunksHash && previous.texts.length > 0) {
          previous.texts.forEach((text, i) => insertChunk.run(m.id, i, text))
        } else {
          needChunks.push(m.id)
        }
      }
    }

    // Invites are upserted, never deleted — a claimed invite's claimed_at must survive
    // being left out of a later push (the desktop only knows about the codes it
    // generated locally; it doesn't track claim state, since claiming happens here).
    const upsertInvite = db.prepare(`
      INSERT INTO invites (code, class_id, revoked, claimed_at, kind, student_id)
      VALUES (@code, @classId, @revoked, NULL, @kind, @studentId)
      ON CONFLICT(code) DO UPDATE SET revoked = @revoked, kind = @kind, student_id = @studentId
        WHERE invites.class_id = @classId
    `)
    for (const i of invites.filter(inPushedClass)) {
      const kind = i.kind === 'class_link' || i.kind === 'student' ? i.kind : null
      // A personal invite must name a student in this push's roster for that class.
      if (kind === 'student' && !inPushedRoster({ classId: i.classId, studentId: i.studentId })) {
        continue
      }
      upsertInvite.run({
        code: i.code,
        classId: i.classId,
        revoked: i.revoked ? 1 : 0,
        kind,
        studentId: kind === 'student' ? i.studentId : null
      })
    }
  })
  run()

  for (const file of previousFiles) {
    if (!writtenFiles.has(file)) fs.rmSync(path.join(UPLOADS_DIR, file), { force: true })
  }

  res.json({ ok: true, needFiles, needChunks })
})

const isSha256 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)

// One homework attachment, sent as raw bytes after a publish asked for it. Accepted only
// for this teacher's own assignment, and only if it's exactly the file that publish
// described (same sha256), so an upload can't swap in something the teacher didn't publish.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
router.post(
  '/homework/:id/file',
  express.raw({ type: 'application/octet-stream', limit: MAX_ATTACHMENT_BYTES }),
  (req, res) => {
    const hw = db
      .prepare(
        `SELECT h.id, h.file_name, h.file_hash, h.file_path FROM homework_assignments h
         JOIN classes c ON c.id = h.class_id WHERE h.id = ? AND c.teacher_id = ?`
      )
      .get(req.params.id, req.teacherId)
    if (!hw || !hw.file_name || !hw.file_hash) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')
    if (hash !== hw.file_hash) {
      return res
        .status(409)
        .json({ error: 'This isn’t the file that was published. Publish again.' })
    }
    const storedName = `${hw.id}-${sanitizeFileName(hw.file_name)}`
    fs.writeFileSync(path.join(UPLOADS_DIR, storedName), bytes)
    if (hw.file_path && hw.file_path !== storedName) {
      fs.rmSync(path.join(UPLOADS_DIR, hw.file_path), { force: true })
    }
    db.prepare('UPDATE homework_assignments SET file_path = ? WHERE id = ?').run(storedName, hw.id)
    res.json({ ok: true })
  }
)

// One material's searchable text, after a publish asked for it; checked against the
// fingerprint that publish described, like attachments above.
router.post('/materials/:id/chunks', (req, res) => {
  const material = db
    .prepare(
      `SELECT m.id, m.chunks_hash FROM materials m JOIN classes c ON c.id = m.class_id
       WHERE m.id = ? AND c.teacher_id = ?`
    )
    .get(req.params.id, req.teacherId)
  if (!material || !material.chunks_hash)
    return res.status(404).json({ error: 'Material not found' })
  const chunks = req.body?.chunks
  if (!Array.isArray(chunks) || !chunks.every((c) => typeof c === 'string')) {
    return res.status(400).json({ error: 'chunks must be a list of text' })
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(chunks)).digest('hex')
  if (hash !== material.chunks_hash) {
    return res.status(409).json({ error: 'This isn’t the text that was published. Publish again.' })
  }
  const insert = db.prepare(
    'INSERT INTO material_chunks (material_id, chunk_index, text) VALUES (?, ?, ?)'
  )
  db.transaction(() => {
    db.prepare('DELETE FROM material_chunks WHERE material_id = ?').run(material.id)
    chunks.forEach((text, i) => insert.run(material.id, i, text))
  })()
  res.json({ ok: true })
})

// Students who joined through a class link and aren't in the desktop app yet, with the
// classes they joined. The desktop imports them under these same ids, so their Portal
// accounts stay attached.
router.get('/new-students', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM students WHERE teacher_id = ? AND origin = 'portal' ORDER BY joined_at`)
    .all(req.teacherId)
  res.json(
    rows.map((s) => ({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      dateOfBirth: s.date_of_birth,
      joinedAt: s.joined_at,
      classIds: db
        .prepare("SELECT class_id FROM enrollments WHERE student_id = ? AND origin = 'portal'")
        .all(s.id)
        .map((e) => e.class_id)
    }))
  )
})

// Which of this teacher's students have a Portal account, for the desktop's "Joined"
// labels next to personal invite links.
router.get('/accounts', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT DISTINCT a.student_id FROM account_students a
         JOIN students s ON s.id = a.student_id WHERE s.teacher_id = ?`
      )
      .all(req.teacherId)
      .map((r) => r.student_id)
  )
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
      feedback: r.feedback,
      aiDeclared: !!r.ai_declared,
      aiHelpCount: r.ai_help_count || 0,
      aiOverlap: r.ai_overlap,
      ...aiUsageSummary(r)
    }))
  )
})

// Everything a student asked the Study Helper, with the answers, optionally for one
// assignment: what the teacher sees behind a "Used AI" badge.
router.get('/ai-activity', (req, res) => {
  const { studentId, homeworkId } = req.query
  const owned = db
    .prepare('SELECT 1 FROM students WHERE id = ? AND teacher_id = ?')
    .get(String(studentId || ''), req.teacherId)
  if (!owned) return res.status(404).json({ error: 'Student not found' })
  res.json(listInteractions(String(studentId), homeworkId ? String(homeworkId) : null))
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
    // Shown inline to every family in the class, so it must really be an image.
    const check = checkUpload(String(imageName), Buffer.from(String(imageData), 'base64'))
    if (!check.ok || !['png', 'jpg', 'gif', 'webp'].includes(check.kind)) {
      return res.status(400).json({ error: 'The photo must be a PNG, JPEG, GIF or WebP image.' })
    }
    const id = crypto.randomUUID()
    const storedName = `${id}-${sanitizeFileName(imageName)}`
    fs.writeFileSync(path.join(POSTS_DIR, storedName), Buffer.from(imageData, 'base64'))
    imagePath = storedName
    db.prepare(
      'INSERT INTO class_posts (id, class_id, body, image_name, image_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, classId, text, imageName, imagePath, new Date().toISOString())
    return res.json({ ok: true })
  }

  db.prepare('INSERT INTO class_posts (id, class_id, body, created_at) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    classId,
    text,
    new Date().toISOString()
  )
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

// Same translate-and-cache endpoint as /me/messages/:id/translate, for the teacher's
// side of the same thread — one cache row per message serves both directions, since
// whoever asks first just supplies whichever targetLang they need.
router.post('/messages/:id/translate', async (req, res) => {
  const targetLang = req.body?.targetLang
  if (!isLanguage(targetLang)) return res.status(400).json({ error: 'Unsupported language' })

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id)
  if (!message || !ownsAccount(req.teacherId, message.account_id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const cached = db
    .prepare('SELECT * FROM message_translations WHERE message_id = ?')
    .get(message.id)
  if (cached && cached.target_lang === targetLang) {
    return res.json({ translatedBody: cached.translated_body })
  }

  try {
    const { system, user } = buildTranslationPrompt(targetLang, message.body)
    const translatedBody = cleanReply(await complete(req.teacherId, system, user, 1500))
    db.prepare(
      `INSERT INTO message_translations (message_id, translated_body, target_lang)
       VALUES (?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET translated_body = excluded.translated_body, target_lang = excluded.target_lang`
    ).run(message.id, translatedBody, targetLang)
    res.json({ translatedBody })
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return res.status(503).json({ error: err.message })
    res.status(502).json({ error: 'Translation failed. Try again in a moment.' })
  }
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
router.post('/digest/send-now', async (req, res) => {
  try {
    const result = await sendAllDigests(req.teacherId)
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
  const problem = passwordProblem(newPassword)
  if (problem) return res.status(400).json({ error: problem })
  const account = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username)
  if (!account || !ownsAccount(req.teacherId, account.id)) {
    return res.status(404).json({ error: 'No such account' })
  }
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword),
    account.id
  )
  // A reset usually means the account may be compromised. Sign out every existing
  // session, including anyone who got in with the old password.
  revokeSessions(account.id)
  res.json({ ok: true })
})

// Profiles of this teacher's own students, as the teacher may see them: no private
// notes, and birthday only as month-day when the student chose to share it.
router.get('/profiles', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.* FROM student_profiles p
       JOIN students s ON s.id = p.student_id
       WHERE s.teacher_id = ?`
    )
    .all(req.teacherId)
  res.json(rows.map((r) => toTeacherView(r.student_id, r)))
})

router.get('/profiles/:studentId/photo', (req, res) => {
  const row = db
    .prepare(
      `SELECT p.photo_file FROM student_profiles p
       JOIN students s ON s.id = p.student_id
       WHERE p.student_id = ? AND s.teacher_id = ?`
    )
    .get(req.params.studentId, req.teacherId)
  if (!row?.photo_file) return res.status(404).json({ error: 'No photo' })
  res.set('Content-Type', 'image/webp')
  res.sendFile(path.join(PROFILE_PHOTOS_DIR, row.photo_file))
})

module.exports = router
