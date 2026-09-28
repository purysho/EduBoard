// Performance check with a heavy teacher's full year: by default 12 classes of 50
// students, 60 marked assessments and 180 days of attendance per class, and a lesson plan
// for each day (36,000 marks, 108,000 attendance records). Times the calls the window
// makes in the background and how long each screen takes to show. Build first:
//   npx electron-vite build && xvfb-run node tools/perf/teacher-year.mjs
// Sizes can be changed with CLASSES, PER, ASSESS, DAYS and PLANS; KEEP=<folder> reuses
// a data folder from an earlier run instead of making a new one (seeding takes minutes).
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { _electron as electron } from 'playwright'
import { createRequire } from 'module'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const ROOT = resolve(import.meta.dirname, '../..')
const ELECTRON = createRequire(import.meta.url)('electron')
const size = (name, fallback) => Number(process.env[name] || fallback)
const sizes = {
  classes: size('CLASSES', 12),
  per: size('PER', 50),
  assess: size('ASSESS', 60),
  days: size('DAYS', 180),
  plans: size('PLANS', 180)
}

const cwd = process.env.KEEP || mkdtempSync(join(tmpdir(), 'eduboard-perf-'))
console.log('data folder:', cwd)
const app = await electron.launch({
  executablePath: ELECTRON,
  args: [ROOT, '--no-sandbox'],
  cwd,
  env: { ...process.env }
})
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.setViewportSize({ width: 1280, height: 860 })
await page.waitForSelector('aside nav', { timeout: 60_000 })

if (!process.env.KEEP) {
  const started = Date.now()
  const made = await page.evaluate(async ({ classes, per, assess, days, plans }) => {
    const api = window.api
    await api.settings.update({ onboardingDismissed: true })
    const iso = (d) => d.toISOString().slice(0, 10)
    const start = new Date()
    start.setDate(start.getDate() - Math.round((days * 7) / 5))
    const schoolDays = []
    for (const d = new Date(start); schoolDays.length < days; d.setDate(d.getDate() + 1)) {
      if (d.getDay() % 6) schoolDays.push(iso(d))
    }
    let marks = 0
    let attendance = 0
    for (let c = 0; c < classes; c++) {
      const cls = await api.classes.create({
        name: `Class ${c + 1}`,
        subject: 'English',
        levelType: 'k12',
        gradeLevel: String(1 + (c % 6)),
        termId: null,
        schedule: null,
        room: null,
        color: null,
        passMark: 60,
        maxScore: 100,
        gradeThresholds: { A: 90, B: 80, C: 70, D: 60 }
      })
      const ids = []
      for (let s = 0; s < per; s++) {
        const student = await api.students.create({
          firstName: `S${s}`,
          lastName: `C${c}`,
          preferredName: null,
          studentNumber: `${c}-${s}`,
          dateOfBirth: null,
          gradeLevel: null,
          guardianName: 'Parent',
          guardianContact: null,
          email: null,
          notes: null
        })
        await api.enrollments.enroll({
          studentId: student.id,
          classId: cls.id,
          enrolledOn: schoolDays[0]
        })
        ids.push(student.id)
      }
      for (let a = 0; a < assess; a++) {
        const assessment = await api.assessments.create({
          classId: cls.id,
          categoryId: null,
          name: `Quiz ${a + 1}`,
          description: null,
          assessmentDate: schoolDays[Math.floor((a * days) / assess)],
          maxScore: 20
        })
        await api.scores.upsertBulk(
          ids.map((studentId, i) => ({
            assessmentId: assessment.id,
            studentId,
            pointsEarned: 8 + ((i * 7 + a * 3) % 13),
            comment: i % 5 ? null : 'Good effort, check spelling.'
          }))
        )
        marks += ids.length
      }
      for (const date of schoolDays) {
        await api.attendance.markBulk(
          ids.map((studentId, i) => ({
            classId: cls.id,
            studentId,
            date,
            status: (i + date.length) % 23 ? 'present' : 'absent'
          }))
        )
        attendance += ids.length
      }
      for (let p = 0; p < plans; p++) {
        await api.lessonPlans.create({
          classId: cls.id,
          date: schoolDays[Math.min(p, schoolDays.length - 1)],
          weekLabel: null,
          title: `Lesson ${p + 1}`,
          objectives: 'Objective text for the lesson.',
          framework: null,
          materials: null,
          activities: 'Warm up; practice; exit ticket.',
          homework: null,
          linkedAssessmentId: null,
          standards: null
        })
      }
    }
    // A Portal address, so the "unpublished changes" check does its full work (nothing
    // listens there; publishing isn't timed).
    await api.settings.update({
      portalUrl: 'http://127.0.0.1:9',
      portalSyncSecret: 'x'.repeat(32)
    })
    return { marks, attendance }
  }, sizes)
  console.log(
    `made ${made.marks} marks and ${made.attendance} attendance records in`,
    `${((Date.now() - started) / 1000).toFixed(0)} s`
  )
}

const line = (what, ms) => console.log(`${what.padEnd(40)}${String(Math.round(ms)).padStart(7)} ms`)

async function timeCall(what, fn, arg) {
  const ms = await page.evaluate(
    async ({ fn, arg }) => {
      const [area, name] = fn.split('.')
      const t = performance.now()
      await window.api[area][name](...(arg === undefined ? [] : [arg]))
      return performance.now() - t
    },
    { fn, arg }
  )
  line(what, ms)
}

const classId = (await page.evaluate(() => window.api.classes.list()))[0].id
const studentId = (await page.evaluate(() => window.api.students.list()))[0].id
await timeCall('unpublished-changes check (every 30 s)', 'portalSync.status')
await timeCall('Dashboard numbers', 'reports.dashboardStats')
await timeCall('Analytics', 'reports.analyticsOverview')
await timeCall("a class's marks", 'scores.listByClass', classId)
await timeCall("a class's attendance", 'attendance.listByClass', classId)

const routes = [
  ['Dashboard', '/'],
  ['Students', '/students'],
  ['Classes', '/classes'],
  ['Roster', `/classes/${classId}`],
  ['Gradebook', `/classes/${classId}/gradebook`],
  ['Attendance', `/classes/${classId}/attendance`],
  ['Lesson plans', `/classes/${classId}/lessons`],
  ['Class report', `/classes/${classId}/report`],
  ['Analytics', '/analytics'],
  ['Calendar', '/calendar'],
  ['Your week', '/weekly-summary'],
  ['Audit log', '/audit-log'],
  ['A student', `/students/${studentId}`]
]
for (const [what, route] of routes) {
  await page.evaluate(() => (location.hash = '#/settings?section=help'))
  await page.waitForTimeout(300)
  const t = Date.now()
  await page.evaluate((r) => (location.hash = '#' + r), route)
  await page.waitForTimeout(50)
  await page.waitForFunction(() => !document.querySelector('main .animate-spin'), null, {
    timeout: 120_000
  })
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  )
  line(`screen: ${what}`, Date.now() - t)
}

await app.close()
if (errors.length) {
  console.log('script errors:', errors)
  process.exit(1)
}
