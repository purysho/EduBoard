const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../db')
const { requireSyncSecret, hashPassword, passwordProblem, revokeSessions } = require('../auth')
const { saveAiSettings, complete, AiNotConfiguredError } = require('../services/ai')
const { isLanguage, buildTranslationPrompt, cleanReply } = require('../services/translate')
const { aiUsageSummary, listInteractions } = require('../services/aiUsage')
const { saveDigestSettings, getDigestSettings, sendMail } = require('../services/mailer')
const { sendAllDigests, previewDigests } = require('../services/digest')
const { isValidTimeZone } = require('../services/deadlines')
const { validateFlashcards, validatePracticeQuiz } = require('../services/practiceSets')
const { checkUpload } = require('../services/fileSafety')
const { toTeacherView } = require('../services/profile')
const { saveTeacherBranding } = require('../services/branding')
const { indexTerms } = require('../services/searchText')
const { PROFILE_PHOTOS_DIR } = require('../paths')
const reportCards = require('./reportCards')
const { removeOrphanedReportCards, reportCardFilesFor } = reportCards

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
router.use('/report-cards', reportCards.teacher)

const { UPLOADS_DIR, SUBMISSIONS_DIR, POSTS_DIR } = require('../paths')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true })

function sanitizeFileName(name) {
  return String(name)
    .replace(/[^\w.-]+/g, '_')
    .slice(-120)
}

/** A grade row's class points as stored JSON: at most 12 { name, total } pairs with
 * short names and whole-number totals, or null. */
function cleanPoints(points) {
  if (!Array.isArray(points)) return null
  const list = points
    .filter((p) => typeof p?.name === 'string' && Number.isInteger(p?.total))
    .slice(0, 12)
    .map((p) => ({ name: p.name.slice(0, 40), total: Math.max(-999, Math.min(999, p.total)) }))
  return list.length ? JSON.stringify(list) : null
}

// A rubric result as the desktop sends it (services/portalAssessments.ts), kept only if
// well formed.
function cleanRubric(rubric) {
  if (!Array.isArray(rubric)) return null
  const finite = (n) => typeof n === 'number' && Number.isFinite(n)
  const list = rubric
    .filter(
      (r) =>
        typeof r?.criterion === 'string' &&
        typeof r?.level === 'string' &&
        finite(r?.points) &&
        finite(r?.maxPoints)
    )
    .slice(0, 30)
    .map((r) => ({
      criterion: r.criterion.slice(0, 120),
      level: r.level.slice(0, 120),
      points: r.points,
      maxPoints: r.maxPoints
    }))
  return list.length ? JSON.stringify(list) : null
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
    assessments = [],
    assessmentScores = [],
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
    digestOptions,
    digestLanguage,
    teacherEmail,
    timeZone,
    appName,
    appLogo
  } = req.body

  // The name and logo of the teacher's app, which the Portal may show (services/branding.js).
  saveTeacherBranding(req.teacherId, { appName, appLogo })

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
    fromName: digestFromName,
    options: digestOptions,
    language: digestLanguage,
    teacherEmail
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
      // Their scores go with them (ON DELETE CASCADE).
      db.prepare(`DELETE FROM assessments WHERE class_id IN (${classIdPlaceholders})`).run(
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
      'INSERT INTO classes (id, teacher_id, name, level_type, finished) VALUES (?, ?, ?, ?, ?)'
    )
    for (const c of classes) {
      insertClass.run(c.id, teacherId, c.name, c.levelType, c.finished ? 1 : 0)
    }

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
      'INSERT OR REPLACE INTO grades (student_id, class_id, percent, letter, attendance_rate, points) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const g of grades.filter(inPushedRoster)) {
      insertGrade.run(
        g.studentId,
        g.classId,
        g.percent,
        g.letter,
        g.attendanceRate,
        cleanPoints(g.points)
      )
    }

    // INSERT OR IGNORE plus the check on `changes`: an id another teacher's class already
    // uses is skipped, and no score is ever attached to an assessment this push didn't write.
    const insertAssessment = db.prepare(
      `INSERT OR IGNORE INTO assessments
         (id, class_id, name, category, assessment_date, max_score, class_average, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const writtenAssessments = new Set()
    assessments.filter(inPushedClass).forEach((a, i) => {
      if (typeof a.id !== 'string' || typeof a.name !== 'string') return
      if (typeof a.maxScore !== 'number' || !(a.maxScore > 0)) return
      const average =
        typeof a.classAverage === 'number' && Number.isFinite(a.classAverage)
          ? a.classAverage
          : null
      const written = insertAssessment.run(
        a.id,
        a.classId,
        a.name.slice(0, 200),
        typeof a.category === 'string' ? a.category.slice(0, 100) : null,
        typeof a.date === 'string' ? a.date.slice(0, 10) : null,
        a.maxScore,
        average,
        i
      )
      if (written.changes) writtenAssessments.add(a.id)
    })
    const insertScore = db.prepare(
      `INSERT OR REPLACE INTO assessment_scores
         (assessment_id, student_id, points, excused, late, comment, rubric)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const sc of assessmentScores) {
      if (!writtenAssessments.has(sc.assessmentId) || !pushedStudentIds.has(sc.studentId)) continue
      insertScore.run(
        sc.assessmentId,
        sc.studentId,
        typeof sc.points === 'number' && Number.isFinite(sc.points) ? sc.points : null,
        sc.excused ? 1 : 0,
        sc.late ? 1 : 0,
        typeof sc.comment === 'string' && sc.comment.trim() ? sc.comment.slice(0, 2000) : null,
        cleanRubric(sc.rubric)
      )
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
      'INSERT INTO material_chunks (material_id, chunk_index, text, terms) VALUES (?, ?, ?, ?)'
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
        m.chunks.forEach((text, i) =>
          insertChunk.run(m.id, i, String(text), indexTerms(String(text)))
        )
      } else if (isSha256(m.chunksHash)) {
        const previous = previousChunks.get(m.id)
        // Only text that actually arrived counts: a material whose upload never
        // happened (or failed) is asked for again.
        if (previous?.hash === m.chunksHash && previous.texts.length > 0) {
          previous.texts.forEach((text, i) => insertChunk.run(m.id, i, text, indexTerms(text)))
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
  // Report cards of a class or student the teacher no longer publishes go too.
  removeOrphanedReportCards()

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
      return res.status(404).json({ error: 'Assignment not found', code: 'PT-3002' })
    }
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')
    if (hash !== hw.file_hash) {
      return res
        .status(409)
        .json({ error: 'This isn’t the file that was published. Publish again.', code: 'PT-5002' })
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
    return res.status(404).json({ error: 'Material not found', code: 'PT-3002' })
  const chunks = req.body?.chunks
  if (!Array.isArray(chunks) || !chunks.every((c) => typeof c === 'string')) {
    return res.status(400).json({ error: 'chunks must be a list of text', code: 'PT-5003' })
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(chunks)).digest('hex')
  if (hash !== material.chunks_hash) {
    return res
      .status(409)
      .json({ error: 'This isn’t the text that was published. Publish again.', code: 'PT-5002' })
  }
  const insert = db.prepare(
    'INSERT INTO material_chunks (material_id, chunk_index, text, terms) VALUES (?, ?, ?, ?)'
  )
  db.transaction(() => {
    db.prepare('DELETE FROM material_chunks WHERE material_id = ?').run(material.id)
    chunks.forEach((text, i) => insert.run(material.id, i, text, indexTerms(text)))
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

// The teacher merged a duplicate student into another in the desktop app (typically
// someone who joined through a class link under a different spelling). Everything the
// duplicate had here — their login, handed-in work, answers, Study Helper history,
// profile — moves to the kept student, so they carry on with the same username and
// password. Where both have the same thing, the kept student's own entry stays.
router.post('/merge-students', (req, res) => {
  const { from, into } = req.body || {}
  if (typeof from !== 'string' || typeof into !== 'string' || !from || !into || from === into) {
    return res.status(400).json({ error: 'from and into are required', code: 'PT-5003' })
  }
  const owner = (id) => db.prepare('SELECT teacher_id FROM students WHERE id = ?').get(id)
  // Only this teacher's own students; the kept one may not have been published yet.
  const fromRow = owner(from)
  const intoRow = owner(into)
  if (
    (fromRow && fromRow.teacher_id !== req.teacherId) ||
    (intoRow && intoRow.teacher_id !== req.teacherId)
  ) {
    return res.status(403).json({ error: 'Not your student', code: 'PT-3001' })
  }
  if (!fromRow) return res.json({ ok: true, moved: false })

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((t) => t.name)
    .filter((name) => name !== 'students')
    .filter((name) =>
      db
        .prepare(`PRAGMA table_info("${name}")`)
        .all()
        .some((c) => c.name === 'student_id')
    )
  db.transaction(() => {
    for (const table of tables) {
      db.prepare(`UPDATE OR IGNORE "${table}" SET student_id = ? WHERE student_id = ?`).run(
        into,
        from
      )
      db.prepare(`DELETE FROM "${table}" WHERE student_id = ?`).run(from)
    }
    db.prepare('DELETE FROM students WHERE id = ? AND teacher_id = ?').run(from, req.teacherId)
  })()
  res.json({ ok: true, moved: true })
})

// The teacher deleted or erased a student in the desktop app. Everything the Portal
// holds about them goes: roster row, enrollments, grades, handed-in work and its files,
// answers, Study Helper history, profile and photo, personal invites, and their login
// if no other student is linked to it. A publish alone only
// replaced the roster row, so the login and work stayed behind, and a student who had
// joined through a class link came straight back on the next "new students" check.
// Once a publish has already removed the roster row, nobody owns what's left, so the
// rest is removed for whichever teacher asks; a student of another teacher is refused.
router.post('/delete-student', (req, res) => {
  const { studentId } = req.body || {}
  if (typeof studentId !== 'string' || !studentId) {
    return res.status(400).json({ error: 'studentId is required', code: 'PT-5003' })
  }
  const row = db.prepare('SELECT teacher_id FROM students WHERE id = ?').get(studentId)
  if (row && row.teacher_id !== req.teacherId) {
    return res.status(403).json({ error: 'Not your student', code: 'PT-3001' })
  }

  const files = []
  for (const r of db
    .prepare('SELECT file_path AS f FROM homework_submissions WHERE student_id = ?')
    .all(studentId)) {
    if (r.f) files.push(path.join(SUBMISSIONS_DIR, r.f))
  }
  const photo = db
    .prepare('SELECT photo_file AS f FROM student_profiles WHERE student_id = ?')
    .get(studentId)
  if (photo?.f) files.push(path.join(PROFILE_PHOTOS_DIR, photo.f))
  files.push(...reportCardFilesFor(studentId))

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((t) => t.name)
    .filter((name) => name !== 'students')
    .filter((name) =>
      db
        .prepare(`PRAGMA table_info("${name}")`)
        .all()
        .some((c) => c.name === 'student_id')
    )
  let removed = 0
  db.transaction(() => {
    const accountIds = db
      .prepare('SELECT account_id FROM account_students WHERE student_id = ?')
      .all(studentId)
      .map((r) => r.account_id)
    for (const table of tables) {
      removed += db.prepare(`DELETE FROM "${table}" WHERE student_id = ?`).run(studentId).changes
    }
    removed += db.prepare('DELETE FROM students WHERE id = ?').run(studentId).changes
    // A login left with no student was theirs alone; its messages, QR logins and reset
    // requests go with it.
    const orphaned = db.prepare(
      'DELETE FROM accounts WHERE id = ? AND NOT EXISTS (SELECT 1 FROM account_students WHERE account_id = ?)'
    )
    for (const id of accountIds) removed += orphaned.run(id, id).changes
  })()
  for (const file of files) fs.rmSync(file, { force: true })
  res.json({ ok: true, removed })
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
  if (!owned) return res.status(404).json({ error: 'Student not found', code: 'PT-3002' })
  res.json(listInteractions(String(studentId), homeworkId ? String(homeworkId) : null))
})

// Teacher stars/unstars a graded submission for the student's Portfolio — pushed
// immediately, same pattern as /submissions/grade.
router.post('/submissions/portfolio', (req, res) => {
  const { homeworkAssignmentId, studentId, portfolio } = req.body
  if (!homeworkAssignmentId || !studentId) {
    return res
      .status(400)
      .json({ error: 'homeworkAssignmentId and studentId required', code: 'PT-5003' })
  }
  if (!ownsAssignment(req.teacherId, homeworkAssignmentId)) {
    return res.status(404).json({ error: 'Assignment not found', code: 'PT-3002' })
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
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
  }
  const submission = db
    .prepare(
      'SELECT * FROM homework_submissions WHERE homework_assignment_id = ? AND student_id = ?'
    )
    .get(req.params.homeworkId, req.params.studentId)
  if (!submission || !submission.file_path)
    return res.status(404).json({ error: 'No file', code: 'PT-3002' })
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

  // Read receipts, per student: a student's family has seen a post once any account
  // linked to that student has opened Class Story since it went up. Students with no
  // Portal login yet are counted separately, since they can't see it at all.
  const classStudents = new Map()
  const studentsIn = (classId) => {
    if (!classStudents.has(classId)) {
      classStudents.set(
        classId,
        db
          .prepare(
            `SELECT s.id, s.first_name, s.last_name,
               (SELECT COUNT(*) FROM account_students a WHERE a.student_id = s.id) AS logins
             FROM enrollments e JOIN students s ON s.id = e.student_id
             WHERE e.class_id = ? AND e.status = 'active'
             ORDER BY s.last_name, s.first_name`
          )
          .all(classId)
      )
    }
    return classStudents.get(classId)
  }
  const seenBy = db.prepare(
    `SELECT DISTINCT a.student_id FROM post_reads r
     JOIN account_students a ON a.account_id = r.account_id
     WHERE r.post_id = ?`
  )
  const repliesTo = db.prepare('SELECT student_id, answer FROM post_replies WHERE post_id = ?')

  res.json(
    rows.map((r) => {
      const students = studentsIn(r.class_id)
      const withLogin = students.filter((s) => s.logins > 0)
      const seen = new Set(seenBy.all(r.id).map((x) => x.student_id))
      return {
        id: r.id,
        classId: r.class_id,
        body: r.body,
        hasImage: !!r.image_path,
        createdAt: r.created_at,
        seenCount: withLogin.filter((s) => seen.has(s.id)).length,
        audience: withLogin.length,
        notSeen: withLogin
          .filter((s) => !seen.has(s.id))
          .map((s) => `${s.first_name} ${s.last_name}`),
        noLogin: students.length - withLogin.length,
        ...replySummary(r, students, withLogin, repliesTo)
      }
    })
  )
})

/** A post's reply slip for the teacher: the question, how many answered what, and who
 * (with a Portal login) hasn't replied yet. Only students still in the class count. */
function replySummary(post, students, withLogin, repliesTo) {
  if (!post.reply_kind) return {}
  const inClass = new Set(students.map((s) => s.id))
  const answers = new Map(
    repliesTo
      .all(post.id)
      .filter((x) => inClass.has(x.student_id))
      .map((x) => [x.student_id, x.answer])
  )
  const count = (answer) => [...answers.values()].filter((a) => a === answer).length
  return {
    replyKind: post.reply_kind,
    replyQuestion: post.reply_question || null,
    replies: { ack: count('ack'), yes: count('yes'), no: count('no') },
    answeredYes: students.filter((s) => answers.get(s.id) === 'yes').map(fullName),
    answeredNo: students.filter((s) => answers.get(s.id) === 'no').map(fullName),
    notReplied: withLogin.filter((s) => !answers.has(s.id)).map(fullName)
  }
}
const fullName = (s) => `${s.first_name} ${s.last_name}`

// Reminds every family (with a Portal login) that hasn't answered a post's reply slip,
// with a message in their thread with the teacher. The desktop app writes the words, in
// the teacher's language.
router.post('/posts/:id/remind', (req, res) => {
  const post = db.prepare('SELECT * FROM class_posts WHERE id = ?').get(req.params.id)
  if (!post || !ownsClass(req.teacherId, post.class_id)) {
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
  }
  const text = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 2000) : ''
  if (!post.reply_kind || !text) {
    return res.status(400).json({ error: 'message required', code: 'PT-5003' })
  }
  const accounts = db
    .prepare(
      `SELECT DISTINCT a.account_id FROM enrollments e
       JOIN account_students a ON a.student_id = e.student_id
       WHERE e.class_id = ? AND e.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM post_replies r WHERE r.post_id = ? AND r.student_id = e.student_id)`
    )
    .all(post.class_id, post.id)
    .map((x) => x.account_id)
  const insert = db.prepare(
    "INSERT INTO messages (id, account_id, sender, body, created_at) VALUES (?, ?, 'teacher', ?, ?)"
  )
  const now = new Date().toISOString()
  db.transaction(() => accounts.forEach((id) => insert.run(crypto.randomUUID(), id, text, now)))()
  res.json({ ok: true, reminded: accounts.length })
})

router.post('/posts', (req, res) => {
  const { classId, body, imageName, imageData } = req.body
  const text = (body || '').trim()
  const replyKind = ['ack', 'yesno'].includes(req.body.replyKind) ? req.body.replyKind : null
  const replyQuestion =
    replyKind === 'yesno' && typeof req.body.replyQuestion === 'string'
      ? req.body.replyQuestion.trim().slice(0, 300) || null
      : null
  if (!classId || !text)
    return res.status(400).json({ error: 'classId and body required', code: 'PT-5003' })
  if (!ownsClass(req.teacherId, classId))
    return res.status(404).json({ error: 'Class not found', code: 'PT-3002' })

  let imagePath = null
  if (imageName && imageData) {
    // Shown inline to every family in the class, so it must really be an image.
    const check = checkUpload(String(imageName), Buffer.from(String(imageData), 'base64'))
    if (!check.ok || !['png', 'jpg', 'gif', 'webp'].includes(check.kind)) {
      return res
        .status(400)
        .json({ error: 'The photo must be a PNG, JPEG, GIF or WebP image.', code: 'PT-3006' })
    }
    const storedName = `${crypto.randomUUID()}-${sanitizeFileName(imageName)}`
    fs.writeFileSync(path.join(POSTS_DIR, storedName), Buffer.from(imageData, 'base64'))
    imagePath = storedName
  }
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO class_posts (id, class_id, body, image_name, image_path, created_at, reply_kind, reply_question)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    classId,
    text,
    imagePath ? imageName : null,
    imagePath,
    new Date().toISOString(),
    replyKind,
    replyQuestion
  )
  res.json({ ok: true, id })
})

router.delete('/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM class_posts WHERE id = ?').get(req.params.id)
  if (!post || !ownsClass(req.teacherId, post.class_id)) {
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
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

// Students who said they forgot their password, waiting for this teacher's OK. Only
// requests for accounts linked to this teacher's own students are shown.
router.get('/reset-requests', (req, res) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const rows = db
    .prepare(
      `SELECT r.id, r.account_id, r.requested_at, a.username
       FROM password_reset_requests r JOIN accounts a ON a.id = r.account_id
       WHERE r.status = 'pending' AND r.requested_at > ? ORDER BY r.requested_at`
    )
    .all(cutoff)
    .filter((r) => ownsAccount(req.teacherId, r.account_id))
  res.json(
    rows.map((r) => ({
      id: r.id,
      username: r.username,
      requestedAt: r.requested_at,
      studentNames: db
        .prepare(
          `SELECT s.first_name, s.last_name FROM account_students acs
           JOIN students s ON s.id = acs.student_id
           WHERE acs.account_id = ? AND s.teacher_id = ?`
        )
        .all(r.account_id, req.teacherId)
        .map((s) => `${s.first_name} ${s.last_name}`)
    }))
  )
})

router.post('/reset-requests/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(req.params.id)
  if (!row || row.status !== 'pending' || !ownsAccount(req.teacherId, row.account_id)) {
    return res.status(404).json({ error: 'That request is no longer waiting', code: 'PT-5007' })
  }
  const status = req.body?.approve ? 'approved' : 'declined'
  db.prepare('UPDATE password_reset_requests SET status = ?, decided_at = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    row.id
  )
  res.json({ ok: true, status })
})

router.post('/messages', (req, res) => {
  const { accountId, body } = req.body
  const text = (body || '').trim()
  if (!accountId || !text)
    return res.status(400).json({ error: 'accountId and body required', code: 'PT-5003' })
  if (!ownsAccount(req.teacherId, accountId))
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
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
  if (!isLanguage(targetLang))
    return res.status(400).json({ error: 'Unsupported language', code: 'PT-3008' })

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id)
  if (!message || !ownsAccount(req.teacherId, message.account_id)) {
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
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
    if (err instanceof AiNotConfiguredError)
      return res.status(503).json({ error: err.message, code: 'PT-4001' })
    res.status(502).json({ error: 'Translation failed. Try again in a moment.', code: 'PT-4002' })
  }
})

router.post('/messages/:accountId/read', (req, res) => {
  if (!ownsAccount(req.teacherId, req.params.accountId)) {
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
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
    res.status(err.name === 'DigestNotConfiguredError' ? 503 : 500).json({
      error: err.message,
      code: err.name === 'DigestNotConfiguredError' ? 'PT-5004' : 'PT-5005'
    })
  }
})

// What each family would get this week, so the teacher can look before it goes.
router.get('/digest/preview', (req, res) => {
  res.json(previewDigests(req.teacherId))
})

// This week's newsletter from the teacher, included at the top of the family digest
// until the given date. An empty text clears it. Stored as text and escaped when the
// email is built, so nothing in it can become HTML.
router.post('/digest/newsletter', (req, res) => {
  const { text, until } = req.body || {}
  if (typeof text !== 'string' || text.length > 20000) {
    return res
      .status(400)
      .json({ error: 'Newsletter text is required (up to 20,000 characters)', code: 'PT-5003' })
  }
  if (until != null && (typeof until !== 'string' || Number.isNaN(Date.parse(until)))) {
    return res.status(400).json({ error: 'until must be a date', code: 'PT-5003' })
  }
  db.prepare(
    `INSERT INTO digest_settings (teacher_id) VALUES (?) ON CONFLICT(teacher_id) DO NOTHING`
  ).run(req.teacherId)
  db.prepare(
    'UPDATE digest_settings SET newsletter = ?, newsletter_until = ? WHERE teacher_id = ?'
  ).run(text.trim() || null, text.trim() ? until || null : null, req.teacherId)
  res.json({ ok: true })
})

// The teacher's own weekly summary, built by the desktop app, emailed to the address
// the teacher set for themselves (never anywhere else).
router.post('/digest/send-teacher', async (req, res) => {
  const { subject, html } = req.body || {}
  if (typeof subject !== 'string' || typeof html !== 'string' || html.length > 500000) {
    return res.status(400).json({ error: 'subject and html are required', code: 'PT-5003' })
  }
  const settings = getDigestSettings(req.teacherId)
  if (!settings?.teacher_email) {
    return res
      .status(400)
      .json({ error: 'Add your own email address in Settings first.', code: 'PT-5006' })
  }
  try {
    await sendMail(req.teacherId, settings.teacher_email, subject.slice(0, 200), html)
    res.json({ ok: true, to: settings.teacher_email })
  } catch (err) {
    res.status(err.name === 'DigestNotConfiguredError' ? 503 : 500).json({
      error: err.message,
      code: err.name === 'DigestNotConfiguredError' ? 'PT-5004' : 'PT-5005'
    })
  }
})

// Teacher-triggered password reset (see portal/README.md — there is deliberately no
// self-service email reset; the teacher does this from the desktop app when a family
// says they're locked out, same day, not an async support queue).
router.post('/reset-password', (req, res) => {
  const { username, newPassword } = req.body
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'username and newPassword are required', code: 'PT-5003' })
  }
  const problem = passwordProblem(newPassword)
  if (problem) return res.status(400).json({ error: problem, code: 'PT-1006' })
  const account = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username)
  if (!account || !ownsAccount(req.teacherId, account.id)) {
    return res.status(404).json({ error: 'No such account', code: 'PT-5008' })
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
  if (!row?.photo_file) return res.status(404).json({ error: 'No photo', code: 'PT-3002' })
  res.set('Content-Type', 'image/webp')
  res.sendFile(path.join(PROFILE_PHOTOS_DIR, row.photo_file))
})

module.exports = router
