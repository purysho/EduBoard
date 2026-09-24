// Lightweight teacher management for a multi-teacher Portal deployment — gated by
// ADMIN_SECRET (see portal/README.md), held by whoever administers the Portal for the
// school. No login UI: a teacher never signs into the Portal itself, only their desktop
// app does (with the sync secret minted here). This is intentionally minimal — enough
// to onboard a school's staff and see who's using the Portal, not a full admin console.
const express = require('express')
const crypto = require('crypto')
const db = require('../db')
const { requireAdminSecret, newRandomToken, hashToken } = require('../auth')

const router = express.Router()
router.use(requireAdminSecret)

// Returns the raw sync secret exactly once — only its hash is ever stored, same
// principle as a QR quick-login token. Hand it to the teacher to paste into their
// desktop app's Settings → Portal sync secret field.
router.post('/teachers', (req, res) => {
  const name = (req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name is required' })

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

// Cascades to that teacher's classes and students (FK ON DELETE CASCADE), but NOT
// further to enrollments/grades/homework_assignments/etc — those aren't declared as
// foreign keys, matching the rest of this schema. Their rows are orphaned, not deleted;
// acceptable for removing a departed teacher (a rare admin action), but worth knowing
// before relying on this to fully scrub someone's data.
router.delete('/teachers/:id', (req, res) => {
  db.prepare('DELETE FROM teachers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
