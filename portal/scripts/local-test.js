// Runs the Portal on this computer for trying it out, with no terminal commands:
// Start-Test-Portal.cmd (Windows) double-clicks into this. Everything it needs is
// created on first run and kept in portal/local-test/ (delete that folder to start over).
//
// - Random secrets are generated once and saved, so the desktop app's Settings only
//   need filling in once.
// - It listens on 127.0.0.1 only: nothing on the network can reach it, which is also
//   why plain http:// is acceptable here (the desktop app allows http only for
//   localhost). A real deployment uses HTTPS; see portal/README.md.
// - A small demo class is published on first run, with an invite link, so the student
//   side can be explored before anything is set up in the desktop app. The first real
//   publish from EduBoard replaces it.
const crypto = require('node:crypto')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const TEST_DIR = path.join(ROOT, 'local-test')
const SETTINGS_FILE = path.join(TEST_DIR, 'settings.json')
const PORT = Number(process.env.PORT) || 4790
const URL_BASE = `http://localhost:${PORT}`
const DEMO_INVITE = 'DEMO-CLASS'

function loadOrCreateSettings() {
  if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
  fs.mkdirSync(TEST_DIR, { recursive: true })
  const secret = () => crypto.randomBytes(24).toString('hex')
  const settings = { sessionSecret: secret(), syncSecret: secret(), adminSecret: secret() }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  return settings
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

function openBrowser(url) {
  if (process.env.NO_BROWSER) return
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  spawn(cmd, args, { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref()
}

/** Puts the sync secret on the clipboard so it can be pasted straight into Settings. */
function copyToClipboard(text) {
  const cmd =
    process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : null
  if (!cmd) return false
  try {
    const child = spawn(cmd, [], { stdio: ['pipe', 'ignore', 'ignore'] })
    child.on('error', () => {})
    child.stdin.end(text)
    return true
  } catch {
    return false
  }
}

function demoPayload() {
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    classes: [{ id: 'demo-class', name: 'Demo: Academic English', levelType: 'university' }],
    students: [
      { id: 'demo-s1', firstName: 'Test', lastName: 'Student', dateOfBirth: null },
      { id: 'demo-s2', firstName: 'Second', lastName: 'Student', dateOfBirth: null }
    ],
    enrollments: [
      { studentId: 'demo-s1', classId: 'demo-class', status: 'active' },
      { studentId: 'demo-s2', classId: 'demo-class', status: 'active' }
    ],
    grades: [
      {
        studentId: 'demo-s1',
        classId: 'demo-class',
        percent: 86,
        letter: 'B+',
        attendanceRate: 0.93
      }
    ],
    invites: [{ code: DEMO_INVITE, classId: 'demo-class', revoked: false }],
    homeworkAssignments: [
      {
        id: 'demo-hw1',
        classId: 'demo-class',
        title: 'Summarise a research article',
        description:
          'Read the article shared in class and write a 150-word summary: the question it asks, how it was studied, and what was found. Attach a .docx or .pdf, or type it below.',
        dueDate: day(3),
        topic: 'Unit 1: Reading'
      },
      {
        id: 'demo-hw2',
        classId: 'demo-class',
        title: 'Vocabulary quick check',
        description: 'Five words from this week.',
        dueDate: day(-1),
        topic: 'Unit 1: Reading',
        questions: [
          {
            id: 'demo-q1',
            type: 'multiple_choice',
            prompt: '"Hypothesis" most nearly means…',
            options: ['a proven fact', 'a testable prediction', 'a summary'],
            correctAnswer: '1',
            points: 1
          }
        ]
      }
    ],
    materials: [
      {
        id: 'demo-m1',
        classId: 'demo-class',
        title: 'How to read a research article',
        studyGuide:
          'Start with the abstract to see the question and the main finding.\nThen read the conclusion, then the method.\nNote any words you do not know and look them up afterwards, not during the first read.',
        flashcards: [
          { front: 'Abstract', back: 'A short summary at the start of an article' },
          { front: 'Method', back: 'How the study was carried out' },
          { front: 'Hypothesis', back: 'A testable prediction' },
          { front: 'Conclusion', back: 'What the authors say their results mean' }
        ],
        chunks: ['Start with the abstract to see the question and the main finding.']
      }
    ]
  }
}

async function publishDemo(settings) {
  const res = await fetch(`${URL_BASE}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': settings.syncSecret },
    body: JSON.stringify(demoPayload())
  })
  if (!res.ok) throw new Error(`demo publish failed: ${res.status} ${await res.text()}`)
  await fetch(`${URL_BASE}/api/sync/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': settings.syncSecret },
    body: JSON.stringify({
      classId: 'demo-class',
      body: 'Welcome to the demo class! Try the 中文 button at the top, and the Translate buttons.'
    })
  })
}

function banner(settings, { demo, copied }) {
  const line = '-'.repeat(72)
  console.log(`
${line}
  EduBoard Portal is running on this computer (local test).
${line}

  Student Portal:  ${URL_BASE}
${demo ? `  Demo class:      ${URL_BASE}/?code=${DEMO_INVITE}   (join as a student)\n` : ''}  Admin page:      ${URL_BASE}/admin.html

  To connect the EduBoard desktop app, open Settings and enter:
    Portal URL:          ${URL_BASE}
    Portal sync secret:  ${settings.syncSecret}${copied ? '\n                         (already copied: just paste it)' : ''}
  Then press Publish to Portal. Your real classes replace the demo class.

  Admin secret (for the admin page): ${settings.adminSecret}

  Everything is saved in portal${path.sep}local-test. Delete that folder to start over.
  Only this computer can open these pages. To stop the Portal, close this window.
${line}
`)
}

async function main() {
  const settings = loadOrCreateSettings()

  if (await portInUse(PORT)) {
    console.log(
      `\n  Something is already running on port ${PORT}, probably the Portal from an earlier`
    )
    console.log('  double-click. Opening it in your browser. If it is not the Portal, close that')
    console.log(`  program, or set PORT to another number.\n`)
    openBrowser(URL_BASE)
    return
  }

  const dataDir = path.join(TEST_DIR, 'data')
  const firstRun = !fs.existsSync(path.join(dataDir, 'portal.db'))
  Object.assign(process.env, {
    SESSION_SECRET: settings.sessionSecret,
    SYNC_SECRET: settings.syncSecret,
    ADMIN_SECRET: settings.adminSecret,
    PORTAL_DATA_DIR: dataDir,
    PORT: String(PORT),
    HOST: '127.0.0.1'
  })
  require('../server')

  for (let i = 0; i < 100 && !(await portInUse(PORT)); i++) {
    await new Promise((r) => setTimeout(r, 100))
  }
  let demo = false
  if (firstRun) {
    try {
      await publishDemo(settings)
      demo = true
    } catch (err) {
      console.log(`  (Couldn't create the demo class: ${err.message})`)
    }
  }
  banner(settings, { demo, copied: copyToClipboard(settings.syncSecret) })
  openBrowser(demo ? `${URL_BASE}/?code=${DEMO_INVITE}` : URL_BASE)
}

main().catch((err) => {
  console.error('\n  The Portal could not start:', err.message)
  process.exitCode = 1
})
