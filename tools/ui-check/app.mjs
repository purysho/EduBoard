// Launch the built EduBoard (dev data dir: <repo>/data) under Playwright's Electron driver.
import { _electron as electron } from 'playwright'
export async function launch() {
  const app = await electron.launch({
    executablePath: '/home/user/eduboard/node_modules/electron/dist/electron',
    args: ['/home/user/eduboard', '--no-sandbox'],
    cwd: '/home/user/eduboard',
    env: { ...process.env, DISPLAY: ':99' }
  })
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.waitForSelector('text=Dashboard')
  return { app, page }
}
export async function go(page, route) {
  await page.evaluate((r) => {
    location.hash = '#' + r
  }, route)
  await page.waitForTimeout(700)
}
export async function seed(page) {
  return page.evaluate(async () => {
    const api = window.api
    const classes = await api.classes.list()
    let cls = classes.find((c) => c.name === 'Grade 4 English')
    if (!cls) {
      cls = await api.classes.create({
        name: 'Grade 4 English',
        subject: 'English',
        levelType: 'k12',
        gradeLevel: '4',
        termId: null,
        schedule: null,
        room: '204',
        color: null,
        passMark: 60,
        maxScore: 100,
        gradeThresholds: { A: 90, B: 80, C: 70, D: 60 }
      })
      const names = [
        ['Mai', 'Chen'],
        ['Leo', 'Wang'],
        ['Ada', 'Li'],
        ['Tom', 'Zhou'],
        ['Yui', 'Sun'],
        ['Ben', 'Xu']
      ]
      for (const [f, l] of names) {
        const s = await api.students.create({
          firstName: f,
          lastName: l,
          preferredName: null,
          studentNumber: null,
          dateOfBirth: null,
          gradeLevel: '4',
          guardianName: null,
          guardianContact: null,
          email: null,
          notes: null
        })
        await api.enrollments.enroll({ studentId: s.id, classId: cls.id, enrolledOn: '2026-09-01' })
      }
    }
    return cls.id
  })
}
