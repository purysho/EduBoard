// Lightweight teacher management for a multi-teacher Portal deployment — gated by
// ADMIN_SECRET (see portal/README.md), held by whoever administers the Portal for the
// school, and used by public/admin.html. A teacher never signs into the Portal itself,
// only their desktop app does (with the sync secret minted here). Intentionally minimal:
// enough to onboard a school's staff and see who's using the Portal.
const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const db = require('../db')
const { requireAdminSecret, newRandomToken, hashToken } = require('../auth')
const { UPLOADS_DIR, SUBMISSIONS_DIR, POSTS_DIR, PROFILE_PHOTOS_DIR } = require('../paths')

const router = express.Router()
router.use(requireAdminSecret)
// Responses can carry a freshly minted sync secret; keep them out of every cache.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Returns the raw sync secret exactly once — only its hash is ever stored, same
// principle as a QR quick-login token. Hand it to the teacher to paste into their
// desktop app's Settings → Portal sync secret field.
router.post('/teachers', (req, res) => {
  const name = (req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name is required' })
  if (name.length > 100) return res.status(400).json({ error: 'name is too long' })

  const id = crypto.randomUUID()
  const syncSecret = newRandomToken()
  db.prepare(
    'INSERT INTO teachers (id, name, sync_secret_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, name, hashToken(syncSecret), new Date().toISOString())

  res.json({ id, name, syncSecret })
})

// A basic roster of who's using this Portal and how much they've published — the seed
// of a school-level admin view (see EduBoardRoadMap.MD Phase 6), not a full dashboard.
router.get('/teachers', (_req, res) => {
  const teachers = db
    .prepare(
      `SELECT t.id, t.name, t.created_at,
              (SELECT COUNT(*) FROM classes WHERE teacher_id = t.id) AS class_count,
              (SELECT COUNT(*) FROM students WHERE teacher_id = t.id) AS student_count
       FROM teachers t ORDER BY t.created_at`
    )
    .all()
  res.json(
    teachers.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      classCount: t.class_count,
      studentCount: t.student_count
    }))
  )
})

// Removing a teacher removes everything their students' data hangs off: grades,
// enrollments, homework (with questions, answers and submissions), materials, invites,
// class posts, student profiles, and any family/student account that was linked only to
// this teacher's students (with its messages and QR logins). Uploaded files go too,
// deleted only after the database change commits. A school removing a departed teacher
// shouldn't leave that teacher's students' work and photos behind on the server.
router.delete('/teachers/:id', (req, res) => {
  const teacherId = req.params.id
  const OWN_CLASSES = 'SELECT id FROM classes WHERE teacher_id = @teacherId'
  const OWN_STUDENTS = 'SELECT id FROM students WHERE teacher_id = @teacherId'
  const OWN_HOMEWORK = `SELECT id FROM homework_assignments WHERE class_id IN (${OWN_CLASSES})`
  const p = { teacherId }

  const files = []
  const collect = (dir, sql) => {
    for (const row of db.prepare(sql).all(p)) if (row.f) files.push(path.join(dir, row.f))
  }

  const run = db.transaction(() => {
    collect(
      UPLOADS_DIR,
      `SELECT file_path AS f FROM homework_assignments WHERE id IN (${OWN_HOMEWORK})`
    )
    collect(
      SUBMISSIONS_DIR,
      `SELECT file_path AS f FROM homework_submissions WHERE homework_assignment_id IN (${OWN_HOMEWORK})`
    )
    collect(POSTS_DIR, `SELECT image_path AS f FROM class_posts WHERE class_id IN (${OWN_CLASSES})`)
    collect(
      PROFILE_PHOTOS_DIR,
      `SELECT photo_file AS f FROM student_profiles WHERE student_id IN (${OWN_STUDENTS})`
    )

    const accountIds = db
      .prepare(
        `SELECT DISTINCT account_id FROM account_students WHERE student_id IN (${OWN_STUDENTS})`
      )
      .all(p)
      .map((r) => r.account_id)

    const statements = [
      `DELETE FROM homework_question_answers WHERE homework_question_id IN
         (SELECT id FROM homework_questions WHERE homework_assignment_id IN (${OWN_HOMEWORK}))`,
      `DELETE FROM homework_questions WHERE homework_assignment_id IN (${OWN_HOMEWORK})`,
      `DELETE FROM homework_submissions WHERE homework_assignment_id IN (${OWN_HOMEWORK})`,
      `DELETE FROM homework_assignments WHERE id IN (${OWN_HOMEWORK})`,
      `DELETE FROM material_chunks WHERE material_id IN (SELECT id FROM materials WHERE class_id IN (${OWN_CLASSES}))`,
      `DELETE FROM materials WHERE class_id IN (${OWN_CLASSES})`,
      `DELETE FROM class_posts WHERE class_id IN (${OWN_CLASSES})`,
      `DELETE FROM invites WHERE class_id IN (${OWN_CLASSES})`,
      `DELETE FROM grades WHERE class_id IN (${OWN_CLASSES}) OR student_id IN (${OWN_STUDENTS})`,
      `DELETE FROM enrollments WHERE class_id IN (${OWN_CLASSES}) OR student_id IN (${OWN_STUDENTS})`,
      `DELETE FROM student_profiles WHERE student_id IN (${OWN_STUDENTS})`,
      `DELETE FROM account_students WHERE student_id IN (${OWN_STUDENTS})`
    ]
    for (const sql of statements) db.prepare(sql).run(p)

    // Accounts left with no linked student belonged only to this teacher's classes.
    // Deleting them cascades to their messages, translations and QR logins.
    const orphaned = db.prepare(
      'DELETE FROM accounts WHERE id = ? AND NOT EXISTS (SELECT 1 FROM account_students WHERE account_id = ?)'
    )
    for (const id of accountIds) orphaned.run(id, id)

    // Classes, students, and the teacher's AI/digest settings cascade from here.
    return db.prepare('DELETE FROM teachers WHERE id = @teacherId').run(p).changes
  })

  const removed = run()
  if (!removed) return res.status(404).json({ error: 'No such teacher' })
  for (const file of files) fs.rmSync(file, { force: true })
  res.json({ ok: true })
})

module.exports = router
