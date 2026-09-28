// Report cards sent privately to families. The teacher's desktop app renders each
// student's report card as a PDF and sends it here (teacher routes, under /api/sync);
// each family sees only their own children's (family routes, under /api/me), and the
// teacher sees who has opened them. Sending the same title again replaces a student's
// card, so a corrected report card reaches families without a second copy.
const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../db')
const { checkUpload } = require('../services/fileSafety')
const { REPORT_CARDS_DIR } = require('../paths')

fs.mkdirSync(REPORT_CARDS_DIR, { recursive: true })

const MAX_BYTES = 10 * 1024 * 1024
const MAX_TITLE = 120

function cleanTitle(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE) : ''
}

function removeFiles(rows) {
  for (const r of rows) fs.rmSync(path.join(REPORT_CARDS_DIR, r.file_path), { force: true })
}

/** Removes report cards whose class or student is no longer on the Portal (a publish
 * dropped them), with their files. */
function removeOrphanedReportCards() {
  const orphans = db
    .prepare(
      `SELECT id, file_path FROM report_cards
       WHERE class_id NOT IN (SELECT id FROM classes) OR student_id NOT IN (SELECT id FROM students)`
    )
    .all()
  if (!orphans.length) return 0
  const del = db.prepare('DELETE FROM report_cards WHERE id = ?')
  db.transaction(() => orphans.forEach((r) => del.run(r.id)))()
  removeFiles(orphans)
  return orphans.length
}

/** The files of a student's report cards, for removing the student entirely. */
function reportCardFilesFor(studentId) {
  return db
    .prepare('SELECT file_path FROM report_cards WHERE student_id = ?')
    .all(studentId)
    .map((r) => path.join(REPORT_CARDS_DIR, r.file_path))
}

// --- Teacher (the desktop app, with its sync secret) ---------------------------------------
const teacher = express.Router()

function ownsClass(teacherId, classId) {
  return !!db
    .prepare('SELECT 1 FROM classes WHERE id = ? AND teacher_id = ?')
    .get(classId, teacherId)
}

// One student's report card: { classId, studentId, title, fileData (base64 PDF) }.
teacher.post('/', (req, res) => {
  const { classId, studentId, fileData } = req.body || {}
  const title = cleanTitle(req.body?.title)
  if (typeof classId !== 'string' || typeof studentId !== 'string' || !title || !fileData) {
    return res
      .status(400)
      .json({ error: 'classId, studentId, title and fileData are required', code: 'PT-5003' })
  }
  if (!ownsClass(req.teacherId, classId)) {
    return res.status(404).json({ error: 'Class not found', code: 'PT-3002' })
  }
  const enrolled = db
    .prepare(
      "SELECT 1 FROM enrollments WHERE class_id = ? AND student_id = ? AND status = 'active'"
    )
    .get(classId, studentId)
  if (!enrolled) {
    return res.status(404).json({ error: 'That student isn’t in this class', code: 'PT-3002' })
  }
  const bytes = Buffer.from(String(fileData), 'base64')
  if (bytes.length > MAX_BYTES) {
    return res.status(413).json({ error: 'That report card is too large.', code: 'PT-3004' })
  }
  if (!checkUpload('report.pdf', bytes).ok) {
    return res.status(400).json({ error: 'A report card must be a PDF.', code: 'PT-3006' })
  }

  const previous = db
    .prepare(
      'SELECT id, file_path FROM report_cards WHERE class_id = ? AND student_id = ? AND title = ?'
    )
    .get(classId, studentId, title)
  const id = crypto.randomUUID()
  const fileName = `${id}.pdf`
  fs.writeFileSync(path.join(REPORT_CARDS_DIR, fileName), bytes)
  db.transaction(() => {
    // A replaced card counts as new: families are shown it again, and it is "not seen yet".
    if (previous) db.prepare('DELETE FROM report_cards WHERE id = ?').run(previous.id)
    db.prepare(
      `INSERT INTO report_cards (id, class_id, student_id, title, file_path, published_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, classId, studentId, title, fileName, new Date().toISOString())
  })()
  if (previous) removeFiles([previous])
  res.json({ ok: true, id, replaced: !!previous })
})

// Each title sent to a class, with who has seen it: a student's family has seen their
// report card once any account linked to that student has opened it. Students with no
// Portal login yet can't see it, so they're counted separately.
teacher.get('/', (req, res) => {
  const classId = String(req.query.classId || '')
  if (!ownsClass(req.teacherId, classId)) {
    return res.status(404).json({ error: 'Class not found', code: 'PT-3002' })
  }
  const cards = db
    .prepare(
      `SELECT r.id, r.student_id, r.title, r.published_at, s.first_name, s.last_name,
         (SELECT COUNT(*) FROM account_students a WHERE a.student_id = r.student_id) AS logins,
         (SELECT MIN(x.read_at) FROM report_card_reads x
            JOIN account_students a ON a.account_id = x.account_id AND a.student_id = r.student_id
          WHERE x.report_card_id = r.id) AS seen_at
       FROM report_cards r JOIN students s ON s.id = r.student_id
       WHERE r.class_id = ?
       ORDER BY r.published_at DESC, s.last_name, s.first_name`
    )
    .all(classId)

  const byTitle = new Map()
  for (const c of cards) {
    if (!byTitle.has(c.title)) byTitle.set(c.title, [])
    byTitle.get(c.title).push(c)
  }
  res.json(
    [...byTitle.entries()].map(([title, rows]) => {
      const withLogin = rows.filter((r) => r.logins > 0)
      return {
        title,
        sentAt: rows
          .map((r) => r.published_at)
          .sort()
          .pop(),
        sent: rows.length,
        audience: withLogin.length,
        seenCount: withLogin.filter((r) => r.seen_at).length,
        students: rows.map((r) => ({
          studentId: r.student_id,
          name: `${r.first_name} ${r.last_name}`,
          hasLogin: r.logins > 0,
          seenAt: r.seen_at || null
        }))
      }
    })
  )
})

// Withdraw a title from a class (every student's copy), e.g. one sent by mistake.
teacher.delete('/', (req, res) => {
  const classId = String(req.query.classId || '')
  const title = cleanTitle(req.query.title)
  if (!ownsClass(req.teacherId, classId)) {
    return res.status(404).json({ error: 'Class not found', code: 'PT-3002' })
  }
  const rows = db
    .prepare('SELECT id, file_path FROM report_cards WHERE class_id = ? AND title = ?')
    .all(classId, title)
  db.prepare('DELETE FROM report_cards WHERE class_id = ? AND title = ?').run(classId, title)
  removeFiles(rows)
  res.json({ ok: true, removed: rows.length })
})

// --- Families (signed in) ---------------------------------------------------------------
const family = express.Router()

function linkedStudentIds(accountId) {
  return db
    .prepare('SELECT student_id FROM account_students WHERE account_id = ?')
    .all(accountId)
    .map((r) => r.student_id)
}

family.get('/', (req, res) => {
  const ids = linkedStudentIds(req.accountId)
  if (!ids.length) return res.json([])
  const rows = db
    .prepare(
      `SELECT r.id, r.student_id, r.title, r.published_at, c.name AS class_name,
         s.first_name, s.last_name,
         EXISTS (SELECT 1 FROM report_card_reads x
                 WHERE x.report_card_id = r.id AND x.account_id = ?) AS opened
       FROM report_cards r
       JOIN classes c ON c.id = r.class_id
       JOIN students s ON s.id = r.student_id
       WHERE r.student_id IN (${ids.map(() => '?').join(',')})
       ORDER BY r.published_at DESC`
    )
    .all(req.accountId, ...ids)
  res.json(
    rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: `${r.first_name} ${r.last_name}`,
      className: r.class_name,
      title: r.title,
      sentAt: r.published_at,
      opened: !!r.opened
    }))
  )
})

// The PDF itself, only for a family linked to that student. Opening it is what counts as
// "seen" for the teacher (the first time only).
family.get('/:id/file', (req, res) => {
  const card = db.prepare('SELECT * FROM report_cards WHERE id = ?').get(req.params.id)
  if (!card || !linkedStudentIds(req.accountId).includes(card.student_id)) {
    return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
  }
  const file = path.join(REPORT_CARDS_DIR, card.file_path)
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found', code: 'PT-3002' })
  db.prepare(
    'INSERT OR IGNORE INTO report_card_reads (report_card_id, account_id, read_at) VALUES (?, ?, ?)'
  ).run(card.id, req.accountId, new Date().toISOString())
  const safeTitle = card.title.replace(/[^\p{L}\p{N} ._-]+/gu, '').trim() || 'report card'
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeTitle)}.pdf`,
    'Cache-Control': 'private, no-store'
  })
  res.sendFile(file)
})

module.exports = { teacher, family, removeOrphanedReportCards, reportCardFilesFor }
