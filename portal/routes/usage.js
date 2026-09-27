// Anonymous "still using it" pings from EduBoard desktop apps whose teacher turned them
// on (Settings → Help improve EduBoard; off by default). Each is a random install id the
// app made up, the app version, the operating system and language, and rough sizes
// (how many classes and students, as bands). Nothing else: no names, no school, and the
// sender's address isn't stored. One row per install per week, so the numbers are
// "installs active that week", and how many are still active 4 and 12 weeks later.
const express = require('express')
const db = require('../db')
const { rateLimit, LIMITS } = require('../rateLimit')

const router = express.Router()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const OS = ['windows', 'mac', 'linux']
const LANGUAGES = ['en', 'zh']
const CLASS_BANDS = ['0', '1-2', '3-5', '6+']
const STUDENT_BANDS = ['0', '1-30', '31-100', '101+']
// A ceiling on distinct installs, so a flood of made-up ids can't fill the disk.
const MAX_INSTALLS = 200000

/** The Monday (UTC) of the week `date` falls in, as YYYY-MM-DD. */
function weekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

router.post('/ping', rateLimit(LIMITS.usagePingPerIp), (req, res) => {
  const b = req.body || {}
  if (
    !UUID.test(String(b.id)) ||
    !VERSION.test(String(b.version)) ||
    !OS.includes(b.os) ||
    !LANGUAGES.includes(b.language) ||
    !CLASS_BANDS.includes(b.classes) ||
    !STUDENT_BANDS.includes(b.students) ||
    typeof b.portal !== 'boolean'
  ) {
    return res.status(400).json({ error: 'Not a usage ping' })
  }
  const week = weekOf(new Date())
  const known = db.prepare('SELECT 1 FROM usage_installs WHERE install_id = ?').get(b.id)
  if (!known) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM usage_installs').get()
    if (n >= MAX_INSTALLS) return res.status(503).json({ error: 'Not accepting new installs' })
    db.prepare('INSERT INTO usage_installs (install_id, first_week) VALUES (?, ?)').run(b.id, week)
  }
  db.prepare(
    `INSERT OR REPLACE INTO usage_pings
       (install_id, week, version, os, language, classes, students, portal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(b.id, week, b.version, b.os, b.language, b.classes, b.students, b.portal ? 1 : 0)
  res.json({ ok: true })
})

/** Weekly active installs, new installs, and 4- and 12-week retention per starting
 * week, for the last `weeks` weeks. Used by the admin route. */
function usageSummary(weeks = 26, now = new Date()) {
  const thisWeek = weekOf(now)
  const start = new Date(`${thisWeek}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 7 * (weeks - 1))
  const from = start.toISOString().slice(0, 10)
  const addWeeks = (w, n) => {
    const d = new Date(`${w}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 7 * n)
    return d.toISOString().slice(0, 10)
  }
  const active = new Map(
    db
      .prepare('SELECT week, COUNT(*) AS n FROM usage_pings WHERE week >= ? GROUP BY week')
      .all(from)
      .map((r) => [r.week, r.n])
  )
  const cohorts = db
    .prepare(
      'SELECT first_week AS week, COUNT(*) AS n FROM usage_installs WHERE first_week >= ? GROUP BY first_week'
    )
    .all(from)
  const stillActive = db.prepare(
    `SELECT COUNT(*) AS n FROM usage_installs i
     JOIN usage_pings p ON p.install_id = i.install_id AND p.week = ?
     WHERE i.first_week = ?`
  )
  const newByWeek = new Map(cohorts.map((c) => [c.week, c.n]))
  const list = []
  for (let w = from; w <= thisWeek; w = addWeeks(w, 1)) {
    const size = newByWeek.get(w) || 0
    const at = (n) =>
      addWeeks(w, n) > thisWeek || !size ? null : stillActive.get(addWeeks(w, n), w).n / size
    list.push({ week: w, active: active.get(w) || 0, new: size, week4: at(4), week12: at(12) })
  }
  const latest = db
    .prepare(
      `SELECT version, os, language, portal, COUNT(*) AS n FROM usage_pings WHERE week = ?
       GROUP BY version, os, language, portal`
    )
    .all(thisWeek)
  return { weeks: list, thisWeek: latest }
}

module.exports = { router, usageSummary, weekOf }
