// End-to-end smoke test: opens the built app (npx electron-vite build first) the way a
// teacher would and checks the things unit tests can't: every screen renders with real
// data, grades show on screen, Chinese switches on, and password protection locks and
// unlocks the real encrypted database. Run by .github/workflows/tests.yml; locally:
//   npx electron-vite build && xvfb-run node tools/e2e/smoke.mjs
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { _electron as electron } from 'playwright'
import { createRequire } from 'module'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const ROOT = resolve(import.meta.dirname, '../..')
const ELECTRON = createRequire(import.meta.url)('electron')
const CRASH = 'This screen couldn’t be shown'
const failures = []
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures.push(what)
}

/** The app with its own empty data folder (in development the data lives in the working
 * directory), so a test run never touches anyone's classes. */
async function launch(extraArgs = []) {
  const cwd = mkdtempSync(join(tmpdir(), 'eduboard-e2e-'))
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [ROOT, '--no-sandbox', ...extraArgs],
    cwd,
    env: { ...process.env }
  })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.waitForSelector('aside nav', { timeout: 60_000 })
  const close = async () => {
    await app.close()
    rmSync(cwd, { recursive: true, force: true })
  }
  return { app, page, errors, close }
}

async function go(page, route) {
  await page.evaluate((r) => (location.hash = '#' + r), route)
  await page.waitForTimeout(900)
}

// 1. Every screen, with a term of made-up data (the sample school).
{
  const { page, errors, close } = await launch(['--sample-school', '--sample-school-fresh'])
  await page.waitForTimeout(1500)
  const classes = await page.evaluate(() => window.api.classes.list())
  const students = await page.evaluate(() => window.api.students.list())
  check(classes.length > 0 && students.length > 0, 'the sample school has classes and students')
  const cls = classes[0].id
  const tabs = [
    '',
    'gradebook',
    'attendance',
    'lessons',
    'seating',
    'classroom',
    'exit-ticket',
    'homework',
    'story',
    'portal',
    'report',
    'settings'
  ]
  const routes = [
    '/',
    '/students',
    `/students/${students[0].id}`,
    '/classes',
    ...tabs.map((t) => `/classes/${cls}${t ? '/' + t : ''}`),
    '/rubrics',
    '/resources',
    '/notebook',
    '/messages',
    '/communications',
    '/composite-grades',
    '/analytics',
    '/audit-log',
    '/timetable',
    '/calendar',
    '/weekly-summary',
    '/newsletter',
    ...['general', 'appearance', 'grading', 'lists', 'portal', 'ai', 'data', 'help'].map(
      (s) => `/settings?section=${s}`
    )
  ]
  for (const route of routes) {
    const before = errors.length
    await go(page, route)
    const crashed = await page.getByText(CRASH).count()
    check(crashed === 0 && errors.length === before, `screen ${route}`)
    if (errors.length > before) console.log('     ', errors.slice(before).join(' | '))
  }

  // Grades show on screen, as percentages.
  await go(page, `/classes/${cls}/gradebook`)
  const percents = await page.getByText(/^\d{1,3}\.\d%$/).count()
  check(percents >= 5, `the gradebook shows students' grades (${percents} seen)`)

  // Chinese.
  await page.evaluate(() => window.api.settings.update({ uiLanguage: 'zh' }))
  await page.reload()
  await page.waitForSelector('aside nav')
  check(
    (await page.locator('aside').innerText()).includes('工作台'),
    'the interface switches to Chinese'
  )
  await page.evaluate(() => window.api.settings.update({ uiLanguage: '' }))
  await page.reload()
  await page.waitForSelector('aside nav')

  // A newsletter draft written here belongs to the sample school (checked in part 2).
  await go(page, '/newsletter')
  await page.getByLabel('Newsletter text').fill('Sample school draft')
  await page.waitForTimeout(500)
  await close()
}

// 2. A new teacher's own data: a class, a score, and password protection.
{
  const { page, errors, close } = await launch()

  // Drafts stay with their own school's data, and are kept.
  await go(page, '/newsletter')
  const draft = page.getByLabel('Newsletter text')
  check(
    !(await draft.inputValue()).includes('Sample school draft'),
    "the sample school's newsletter draft doesn't appear in the teacher's own data"
  )
  await draft.fill('My own draft')
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForSelector('aside nav')
  await go(page, '/newsletter')
  check(
    (await page.getByLabel('Newsletter text').inputValue()) === 'My own draft',
    'a newsletter draft is kept'
  )

  // A new class, made through the form, opens straight away for adding students.
  await go(page, '/classes')
  await page
    .getByRole('button', { name: /New class/ })
    .first()
    .click()
  await page.keyboard.type('Form class')
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.waitForTimeout(1200)
  check(
    /#\/classes\/[^/]+$/.test(page.url()) && (await page.getByText('Form class').count()) > 0,
    'saving a new class opens it'
  )

  const grade = await page.evaluate(async () => {
    const api = window.api
    const cls = await api.classes.create({
      name: 'Smoke test class',
      subject: null,
      levelType: 'k12',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: { A: 90, B: 80, C: 70, D: 60 }
    })
    const s = await api.students.create({
      firstName: 'Mai',
      lastName: 'Chen',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    await api.enrollments.enroll({ studentId: s.id, classId: cls.id, enrolledOn: '2026-09-01' })
    const a = await api.assessments.create({
      classId: cls.id,
      categoryId: null,
      name: 'Quiz',
      description: null,
      assessmentDate: '2026-09-10',
      maxScore: 50
    })
    await api.scores.upsert({ assessmentId: a.id, studentId: s.id, pointsEarned: 45 })
    return cls.id
  })
  await go(page, `/classes/${grade}/gradebook`)
  check((await page.getByText('90.0%').count()) > 0, 'a new class shows 45/50 as 90.0%')

  const password = ['smoke', 'test', 'pass', '9'].join('-')
  const status = await page.evaluate(async (pw) => {
    const api = window.api
    await api.security.enable(pw)
    const on = await api.security.status()
    await api.security.lock()
    const locked = await api.security.status()
    await api.security.unlock(pw)
    const unlocked = await api.security.status()
    const classes = await api.classes.list()
    await api.security.disable(pw)
    const off = await api.security.status()
    return { on, locked, unlocked, off, classes: classes.length }
  }, password)
  check(JSON.stringify(status.on).includes('true'), 'password protection turns on')
  check(status.classes === 2, 'after locking and unlocking, the classes are still there')
  check(JSON.stringify(status.off) !== JSON.stringify(status.on), 'password protection turns off')
  check(errors.length === 0, 'no script errors in the window')
  if (errors.length) console.log('     ', errors.join(' | '))
  await close()
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
