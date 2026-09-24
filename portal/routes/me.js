const express = require('express')
const crypto = require('crypto')
const path = require('path')
const QRCode = require('qrcode')
const db = require('../db')
const { requireAuth, newRandomToken, hashToken } = require('../auth')
const { complete, AiNotConfiguredError } = require('../services/ai')

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

// A family's linked student(s) all belong to the same teacher in practice (an invite
// always comes from one class); this just reads the first linked student's teacher_id.
function getTeacherIdForAccount(accountId) {
  const row = db
    .prepare(
      `SELECT s.teacher_id FROM account_students acs
       JOIN students s ON s.id = acs.student_id
       WHERE acs.account_id = ? LIMIT 1`
    )
    .get(accountId)
  return row ? row.teacher_id : null
}

function getActiveClassIds(studentIds) {
  const classIds = new Set()
  for (const studentId of studentIds) {
    db.prepare("SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active'")
      .all(studentId)
      .forEach((r) => classIds.add(r.class_id))
  }
  return [...classIds]
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

            // correct_answer never goes to the browser — only whether THIS student's own
            // prior answer (if any) was marked correct, once they've already submitted.
            const questions = db
              .prepare(
                'SELECT * FROM homework_questions WHERE homework_assignment_id = ? ORDER BY sort_order'
              )
              .all(h.id)
              .map((q) => {
                const answer = db
                  .prepare(
                    'SELECT * FROM homework_question_answers WHERE homework_question_id = ? AND student_id = ?'
                  )
                  .get(q.id, studentId)
                return {
                  id: q.id,
                  type: q.type,
                  prompt: q.prompt,
                  options: q.options ? JSON.parse(q.options) : null,
                  points: q.points,
                  yourAnswer: answer?.answer ?? null,
                  wasCorrect: answer ? !!answer.correct : null
                }
              })

            return {
              id: h.id,
              title: h.title,
              description: h.description,
              dueDate: h.due_date,
              fileName: h.file_name,
              topic: h.topic,
              status: submission?.status ?? 'not_started',
              textAnswer: submission?.text_answer ?? null,
              submissionFileName: submission?.file_name ?? null,
              grade: submission?.grade ?? null,
              feedback: submission?.feedback ?? null,
              questions
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

// A student answers an assignment's auto-graded Quick Check — graded and scored
// immediately, no teacher review needed. If the assignment ALSO has a freeform
// text/file component, this only touches the question-answer side; grading here still
// sets the submission's overall status/grade, since a Quick-Check-only assignment has
// nothing else to grade.
router.post('/homework/:id/answers', (req, res) => {
  const { studentId, answers } = req.body
  if (!studentId || !getLinkedStudentIds(req.accountId).includes(studentId)) {
    return res.status(403).json({ error: 'Not your student' })
  }
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers required' })
  }

  const hw = db.prepare('SELECT class_id FROM homework_assignments WHERE id = ?').get(
    req.params.id
  )
  if (!hw) return res.status(404).json({ error: 'Assignment not found' })
  const enrolled = db
    .prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'")
    .get(studentId, hw.class_id)
  if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this class' })

  const questions = db
    .prepare('SELECT * FROM homework_questions WHERE homework_assignment_id = ?')
    .all(req.params.id)
  if (!questions.length) return res.status(400).json({ error: 'This assignment has no questions' })

  const normalize = (s) => String(s ?? '').trim().toLowerCase()
  let earned = 0
  let possible = 0
  const results = []

  const saveAnswer = db.prepare(
    `INSERT INTO homework_question_answers (homework_question_id, student_id, answer, correct)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(homework_question_id, student_id) DO UPDATE SET answer = excluded.answer, correct = excluded.correct`
  )

  const run = db.transaction(() => {
    for (const q of questions) {
      possible += q.points
      const given = answers[q.id]
      const correct = normalize(given) === normalize(q.correct_answer)
      if (correct) earned += q.points
      saveAnswer.run(q.id, studentId, String(given ?? ''), correct ? 1 : 0)
      results.push({ questionId: q.id, correct })
    }
  })
  run()

  const grade = `${earned}/${possible}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO homework_submissions
       (homework_assignment_id, student_id, status, submitted_at, updated_at, grade, graded_at)
     VALUES (?, ?, 'done', ?, ?, ?, ?)
     ON CONFLICT(homework_assignment_id, student_id) DO UPDATE
       SET status = 'done', submitted_at = COALESCE(submitted_at, ?), updated_at = ?, grade = ?, graded_at = ?`
  ).run(req.params.id, studentId, now, now, grade, now, now, now, grade, now)

  res.json({ grade, results })
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

// The family's curated "best work" view — every submission the teacher starred,
// across all of this account's linked students, newest-graded first.
router.get('/portfolio', (req, res) => {
  const studentIds = getLinkedStudentIds(req.accountId)
  if (!studentIds.length) return res.json([])

  const placeholders = studentIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT sub.*, hw.title, hw.topic, hw.class_id, c.name AS class_name,
              s.first_name, s.last_name
       FROM homework_submissions sub
       JOIN homework_assignments hw ON hw.id = sub.homework_assignment_id
       JOIN classes c ON c.id = hw.class_id
       JOIN students s ON s.id = sub.student_id
       WHERE sub.student_id IN (${placeholders}) AND sub.portfolio = 1
       ORDER BY sub.graded_at DESC`
    )
    .all(...studentIds)

  res.json(
    rows.map((r) => ({
      studentName: `${r.first_name} ${r.last_name}`,
      className: r.class_name,
      title: r.title,
      topic: r.topic,
      grade: r.grade,
      feedback: r.feedback,
      gradedAt: r.graded_at
    }))
  )
})

const POSTS_DIR = path.join(__dirname, '..', 'data', 'post-images')
require('fs').mkdirSync(POSTS_DIR, { recursive: true })

// Every post from every class this account's student(s) are actively enrolled in,
// newest first — a family with two kids in different classes sees one combined feed.
router.get('/posts', (req, res) => {
  const studentIds = getLinkedStudentIds(req.accountId)
  if (!studentIds.length) return res.json([])

  const classIds = getActiveClassIds(studentIds)
  if (!classIds.length) return res.json([])

  const placeholders = classIds.map(() => '?').join(',')
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

// Cheap poll target for the Portal's unread-messages badge — deliberately just a count,
// not the full /me payload, so polling every 20s or so while the tab is open doesn't
// re-run every join in /me each time.
router.get('/notifications', (req, res) => {
  const unreadMessages = db
    .prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE account_id = ? AND sender = 'teacher' AND read_by_family = 0"
    )
    .get(req.accountId).n
  res.json({ unreadMessages })
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

// Translates one message into targetLang and caches the result — a message is
// translated at most once per target language, not on every view. Uses the teacher's
// own AI key (same provider as the student AI chat), so it costs nothing extra to set
// up if that's already configured; if it isn't, the family just sees the original text
// with no translate option, rather than an error.
router.post('/messages/:id/translate', async (req, res) => {
  const targetLang = (req.body?.targetLang || '').trim()
  if (!targetLang) return res.status(400).json({ error: 'targetLang is required' })

  const message = db
    .prepare('SELECT * FROM messages WHERE id = ? AND account_id = ?')
    .get(req.params.id, req.accountId)
  if (!message) return res.status(404).json({ error: 'Not found' })

  const cached = db
    .prepare('SELECT * FROM message_translations WHERE message_id = ?')
    .get(message.id)
  if (cached && cached.target_lang === targetLang) {
    return res.json({ translatedBody: cached.translated_body })
  }

  const teacherId = getTeacherIdForAccount(req.accountId)
  try {
    const translated = await complete(
      teacherId,
      'You translate short parent-teacher messages. Reply with ONLY the translation, ' +
        'no notes, no quotes, no original text — preserve tone and meaning exactly.',
      `Translate this message into ${targetLang}:\n\n${message.body}`,
      500
    )
    const translatedBody = translated.trim()
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

// Every resource the teacher shared with a class this account's student(s) are
// actively enrolled in — the student-facing reading list, each with its AI study guide
// if one's been generated.
router.get('/materials', (req, res) => {
  const studentIds = getLinkedStudentIds(req.accountId)
  const classIds = getActiveClassIds(studentIds)
  if (!classIds.length) return res.json([])

  const placeholders = classIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT m.*, c.name AS class_name FROM materials m
       JOIN classes c ON c.id = m.class_id
       WHERE m.class_id IN (${placeholders})`
    )
    .all(...classIds)

  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      className: r.class_name,
      studyGuide: r.study_guide
    }))
  )
})

// Keyword-searches this account's in-scope materials (chunks belonging to a class one
// of their students is actively enrolled in) and returns the best-matching chunks with
// which material each came from, for citation. Mirrors the desktop Notebook's own
// searchResourceChunks, just re-implemented in SQL against the Portal's own FTS table.
function searchMaterials(classIds, query, limit) {
  if (!classIds.length) return []
  const ftsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(' OR ')
  if (!ftsQuery) return []

  const classPlaceholders = classIds.map(() => '?').join(',')
  return db
    .prepare(
      `SELECT mc.material_id, mc.chunk_index, mc.text, m.title
       FROM material_chunks mc
       JOIN materials m ON m.id = mc.material_id
       WHERE mc.material_chunks MATCH ? AND m.class_id IN (${classPlaceholders})
       ORDER BY rank LIMIT ?`
    )
    .all(ftsQuery, ...classIds, limit)
}

// A light-context study helper: not full RAG over every resource, but grounded in the
// student's own current classes and homework so answers reference their actual work
// rather than being generic — e.g. "explain photosynthesis" gets an answer that also
// knows they have a Bio assignment due Friday.
function buildStudyContext(studentId) {
  const classes = db
    .prepare(
      `SELECT c.name FROM enrollments e JOIN classes c ON c.id = e.class_id
       WHERE e.student_id = ? AND e.status = 'active'`
    )
    .all(studentId)
  const homework = db
    .prepare(
      `SELECT h.title, h.topic, h.due_date, c.name AS class_name
       FROM homework_assignments h JOIN classes c ON c.id = h.class_id
       JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = ?
       WHERE e.status = 'active'
       ORDER BY h.due_date DESC LIMIT 15`
    )
    .all(studentId)

  const classList = classes.map((c) => c.name).join(', ') || 'none on record'
  const hwList =
    homework
      .map((h) => `- "${h.title}"${h.topic ? ` (${h.topic})` : ''} in ${h.class_name}`)
      .join('\n') || 'none on record'

  return `This student is enrolled in: ${classList}.\nTheir recent/current homework:\n${hwList}`
}

router.post('/ai/chat', async (req, res) => {
  const { studentId, message } = req.body
  const text = (message || '').trim()
  if (!studentId || !getLinkedStudentIds(req.accountId).includes(studentId)) {
    return res.status(403).json({ error: 'Not your student' })
  }
  if (!text) return res.status(400).json({ error: 'Message is empty' })

  const classIds = getActiveClassIds([studentId])
  const materialMatches = searchMaterials(classIds, text, 6)

  let system =
    'You are a friendly, patient study helper for a K-12/university student. Explain ' +
    'things clearly and simply, encourage them, and never just do their homework for ' +
    'them outright — guide them toward understanding it. Keep answers concise. Use the ' +
    "context below about the student's classes and homework only to make your answer " +
    'more relevant; do not mention this context block itself.\n\n' +
    buildStudyContext(studentId)

  let citations = []
  if (materialMatches.length) {
    const contextBlock = materialMatches
      .map((m, i) => `[${i + 1}] (from "${m.title}")\n${m.text}`)
      .join('\n\n')
    system +=
      '\n\nThe student’s teacher has also shared these excerpts from class materials that ' +
      'may be relevant. If you use one, cite it with its bracketed number like [1] — only ' +
      'cite an excerpt if you actually relied on it, and only state facts the excerpts or ' +
      'your general knowledge support:\n\n' +
      contextBlock
    citations = materialMatches.map((m, i) => ({
      number: i + 1,
      title: m.title,
      snippet: m.text.length > 220 ? `${m.text.slice(0, 220)}…` : m.text
    }))
  }

  try {
    const student = db.prepare('SELECT teacher_id FROM students WHERE id = ?').get(studentId)
    const reply = await complete(student.teacher_id, system, text, 900)
    res.json({ reply: reply.trim(), citations })
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return res.status(503).json({ error: err.message })
    res.status(502).json({ error: 'AI request failed. Try again in a moment.' })
  }
})

// A family opts into the weekly digest email by setting an address here — nothing is
// sent unless both this is set AND the teacher has SMTP configured. Empty string
// clears it (opt back out).
router.get('/account', (req, res) => {
  const account = db.prepare('SELECT username, email FROM accounts WHERE id = ?').get(
    req.accountId
  )
  res.json(account)
})

router.post('/account', (req, res) => {
  const email = (req.body?.email || '').trim()
  db.prepare('UPDATE accounts SET email = ? WHERE id = ?').run(email || null, req.accountId)
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
