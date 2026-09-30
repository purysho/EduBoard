import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import {
  getExitTicketByClass,
  isAcceptingResponses,
  submitExitTicketResponse
} from '../repositories/exitTickets'
import { getRosterForClass } from '../repositories/enrollments'
import { markAttendance } from '../repositories/attendanceRecords'
import { getLessonPlan, listLessonResourceIds } from '../repositories/lessonPlans'
import { getLessonResource } from '../repositories/lessonResources'
import { isSafeExternalUrl } from '@shared/externalUrl'
import type {
  AttendanceCheckInStatus,
  ClassroomHubStatus,
  ExitTicketServerInfo
} from '@shared/types'
import { tr, uiLanguage } from '@shared/i18n'

// Fixed port with a few fallbacks in case something else on the machine already holds
// it. Never anything but a plain loopback-adjacent LAN port — this server is meant to
// be reachable only from devices on the same classroom WiFi, never the internet.
const CANDIDATE_PORTS = [51820, 51821, 51822, 51823]

let server: Server | null = null
let boundPort: number | null = null
const openClassroomHubs = new Map<string, string>()

function getLanIp(): string | null {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

/** A student's name as it appears on their device's list. */
function rosterName(student: {
  firstName: string
  lastName: string
  preferredName?: string | null
}): string {
  return `${student.preferredName?.trim() || student.firstName} ${student.lastName}`.trim()
}

function activeRoster(classId: string): { id: string; name: string }[] {
  return getRosterForClass(classId)
    .filter((r) => r.enrollment.status === 'active')
    .map((r) => ({ id: r.student.id, name: rosterName(r.student) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// These limits only stop one device flooding a session. Per device (its cookie) the
// limit is tight; per network address it's generous, because on some school networks
// every phone in the room reaches this computer from the same address.
const PER_DEVICE_PER_MINUTE = 12
const PER_ADDRESS_PER_MINUTE = 120
const recentSubmits = new Map<string, number[]>()

/** Counts one try against `key` and says whether it's over `limit` in the last minute. */
export function overSubmitLimit(key: string, limit: number, now: number = Date.now()): boolean {
  const since = now - 60_000
  const times = (recentSubmits.get(key) ?? []).filter((t) => t > since)
  const over = times.length >= limit
  if (!over) times.push(now)
  recentSubmits.set(key, times)
  return over
}

function tooManyTries(req: IncomingMessage): boolean {
  const device = deviceId(req)
  const overDevice = device ? overSubmitLimit(`device:${device}`, PER_DEVICE_PER_MINUTE) : false
  const overAddress = overSubmitLimit(
    `address:${req.socket.remoteAddress ?? ''}`,
    PER_ADDRESS_PER_MINUTE
  )
  return overDevice || overAddress
}

const DEVICE_COOKIE = 'eb_device'

/** A random id the check-in page gives each phone, so one phone can't check in the
 * whole class. Not a login: a student can clear it, which only moves them to the
 * teacher's attendance grid like before. */
function deviceId(req: IncomingMessage): string | null {
  const match = (req.headers.cookie ?? '').match(/(?:^|;\s*)eb_device=([a-f0-9]{32})(?:;|$)/)
  return match ? match[1] : null
}

function ensureDeviceCookie(req: IncomingMessage, res: ServerResponse): void {
  if (deviceId(req)) return
  res.setHeader(
    'Set-Cookie',
    `${DEVICE_COOKIE}=${randomBytes(16).toString('hex')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Fully self-contained: no external stylesheets, scripts, or fonts — everything a
 * student's browser needs is inline in this one response. Critical for the "works with
 * no internet and no VPN" requirement: a page that tried to load so much as a Google
 * Font would just hang for a student with no outside connectivity. */
function renderPage(classId: string): string {
  const ticket = getExitTicketByClass(classId)

  if (!ticket || !isAcceptingResponses(ticket)) {
    return `<!doctype html>
<html lang="${uiLanguage() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tr('Exit Ticket'))}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#475569;text-align:center;padding:24px}</style>
</head><body><p>${escapeHtml(tr('No exit ticket is open right now. Ask your teacher.'))}</p></body></html>`
  }

  // Students pick themselves from the class list; a class with no roster yet falls back
  // to typing a name.
  const roster = activeRoster(classId)
  const nameField = roster.length
    ? `<select id="who" name="_student" required><option value="">${escapeHtml(tr('Choose your name…'))}</option>${roster
        .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`)
        .join('')}</select>`
    : '<input id="who" type="text" name="_name" required>'

  const questionsHtml = ticket.questions
    .map((q, i) => {
      const label = `<label class="q"><span class="qn">${i + 1}.</span> ${escapeHtml(q.prompt)}</label>`
      if (q.type === 'choice' && q.options?.length) {
        const options = q.options
          .map(
            (opt) =>
              `<label class="opt"><input type="radio" name="q_${q.id}" value="${escapeHtml(opt)}" required> ${escapeHtml(opt)}</label>`
          )
          .join('')
        return `<div class="question">${label}<div class="opts">${options}</div></div>`
      }
      return `<div class="question">${label}<textarea name="q_${q.id}" required></textarea></div>`
    })
    .join('')

  return `<!doctype html>
<html lang="${uiLanguage() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ticket.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
  .wrap{max-width:480px;margin:0 auto;padding:24px 16px}
  h1{font-size:1.25rem;margin:0 0 20px}
  .question{margin-bottom:20px}
  .q{display:block;font-weight:600;margin-bottom:8px}
  .qn{color:#6366f1}
  textarea{width:100%;min-height:70px;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;resize:vertical}
  input[type=text],select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;background:#fff}
  .opts{display:flex;flex-direction:column;gap:6px}
  .opt{display:flex;align-items:center;gap:8px;font-weight:400}
  button{width:100%;padding:14px;background:#6366f1;color:#fff;border:none;border-radius:8px;font:inherit;font-weight:600;font-size:1rem}
  button:disabled{opacity:.5}
  #done{display:none;text-align:center;padding:60px 0;font-size:1.1rem}
</style></head>
<body><div class="wrap">
  <form id="f">
    <h1>${escapeHtml(ticket.title)}</h1>
    <div class="question">
      <label class="q" for="who">${escapeHtml(tr('Your name'))}</label>
      ${nameField}
    </div>
    ${questionsHtml}
    <button type="submit">${escapeHtml(tr('Submit'))}</button>
  </form>
  <div id="done">${escapeHtml(tr('Thanks — your answers were submitted.'))}</div>
</div>
<script>
document.getElementById('f').addEventListener('submit', function (e) {
  e.preventDefault()
  var btn = e.target.querySelector('button')
  btn.disabled = true
  var data = new FormData(e.target)
  var answers = {}
  data.forEach(function (value, key) {
    if (key.indexOf('q_') === 0) answers[key.slice(2)] = String(value)
  })
  fetch(window.location.pathname + '/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: data.get('_student'), studentName: data.get('_name'), answers: answers })
  }).then(function (res) {
    if (res.ok) {
      document.getElementById('f').style.display = 'none'
      document.getElementById('done').style.display = 'block'
    } else {
      btn.disabled = false
      res.text().then(function (t) { alert(t || ${JSON.stringify(tr('Something went wrong — please try again.'))}) })
    }
  }).catch(function () {
    btn.disabled = false
    alert(${JSON.stringify(tr('Could not submit — check you are still on the classroom WiFi and try again.'))})
  })
})
</script>
</body></html>`
}

// Which classes currently have a QR attendance check-in session open, and who has
// checked in so far. In-memory only — like the server itself, a check-in session is a
// live-class-period concept, not something that needs to survive an app restart; the
// teacher just starts a new one next period.
const openCheckIns = new Map<
  string,
  { date: string; checkedInStudentIds: Set<string>; studentByDevice: Map<string, string> }
>()

export function openAttendanceCheckIn(classId: string, date: string): void {
  openCheckIns.set(classId, { date, checkedInStudentIds: new Set(), studentByDevice: new Map() })
}

export function closeAttendanceCheckIn(classId: string): void {
  openCheckIns.delete(classId)
}

export function getAttendanceCheckInStatus(classId: string): AttendanceCheckInStatus {
  const session = openCheckIns.get(classId)
  if (!session) return { open: false, date: null, checkedInStudentIds: [] }
  return { open: true, date: session.date, checkedInStudentIds: [...session.checkedInStudentIds] }
}

function renderAttendancePage(classId: string): string {
  const session = openCheckIns.get(classId)

  if (!session) {
    return `<!doctype html>
<html lang="${uiLanguage() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tr('Attendance'))}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#475569;text-align:center;padding:24px}</style>
</head><body><p>${escapeHtml(tr('No attendance check-in is open right now. Ask your teacher.'))}</p></body></html>`
  }

  const roster = getRosterForClass(classId).filter((r) => r.enrollment.status === 'active')
  const studentsHtml = roster
    .map(({ student }) => {
      const name = escapeHtml(rosterName(student))
      const checkedIn = session.checkedInStudentIds.has(student.id)
      return `<button class="s${checkedIn ? ' done' : ''}" data-id="${student.id}" ${checkedIn ? 'disabled' : ''}>${name}${checkedIn ? ' ✓' : ''}</button>`
    })
    .join('')

  return `<!doctype html>
<html lang="${uiLanguage() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tr('Attendance'))}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
  .wrap{max-width:480px;margin:0 auto;padding:24px 16px}
  h1{font-size:1.25rem;margin:0 0 4px}
  p.hint{color:#64748b;margin:0 0 20px;font-size:.9rem}
  .grid{display:flex;flex-direction:column;gap:8px}
  .s{padding:14px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:1rem;text-align:left}
  .s.done{background:#ecfdf5;border-color:#10b981;color:#047857}
  .s:disabled{opacity:.7}
  #done{display:none;text-align:center;padding:60px 0;font-size:1.1rem}
</style></head>
<body><div class="wrap">
  <div id="list">
    <h1>${escapeHtml(tr('Attendance check-in'))}</h1>
    <p class="hint">${escapeHtml(tr('Tap your name to mark yourself present.'))}</p>
    <div class="grid">${studentsHtml}</div>
  </div>
  <div id="done">${escapeHtml(tr('You’re checked in — thanks!'))}</div>
</div>
<script>
document.querySelectorAll('.s').forEach(function (btn) {
  btn.addEventListener('click', function () {
    btn.disabled = true
    fetch(window.location.pathname + '/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: btn.getAttribute('data-id') })
    }).then(function (res) {
      if (res.ok) {
        document.getElementById('list').style.display = 'none'
        document.getElementById('done').style.display = 'block'
      } else {
        btn.disabled = false
        res.text().then(function (t) { alert(t || ${JSON.stringify(tr('Something went wrong — please try again.'))}) })
      }
    }).catch(function () {
      btn.disabled = false
      alert(${JSON.stringify(tr('Could not check in — check you are still on the classroom WiFi and try again.'))})
    })
  })
})
</script>
</body></html>`
}


function textBlock(value: string | null): string {
  return value ? escapeHtml(value).replace(/\n/g, '<br>') : ''
}

function renderClassroomHubPage(classId: string): string {
  const lessonId = openClassroomHubs.get(classId)
  const lesson = lessonId ? getLessonPlan(lessonId) : undefined
  if (!lesson || lesson.classId !== classId) {
    return `<!doctype html>
<html lang="${uiLanguage() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tr('Classroom Hub'))}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#475569;text-align:center;padding:24px}</style>
</head><body><p>${escapeHtml(tr('This classroom hub is closed.'))}</p></body></html>`
  }

  const sections: [string, string | null][] = [
    [tr('Objectives'), lesson.objectives],
    [tr('Activities'), lesson.activities],
    [tr('Materials'), lesson.materials],
    [tr('Need more help?'), lesson.support],
    [tr('Challenge'), lesson.stretch],
    [tr('Homework'), lesson.homework]
  ]
  const sectionHtml = sections
    .filter(([, value]) => !!value?.trim())
    .map(
      ([label, value]) =>
        `<section><h2>${escapeHtml(label)}</h2><div class="body">${textBlock(value)}</div></section>`
    )
    .join('')

  const resources = listLessonResourceIds(lesson.id)
    .map((id) => getLessonResource(id))
    .filter((resource) => resource?.shareWithStudents)
  const resourceHtml = resources.length
    ? `<section><h2>${escapeHtml(tr('Shared resources'))}</h2><div class="resources">${resources
        .map((resource) => {
          if (!resource) return ''
          const title = escapeHtml(resource.title)
          if (resource.type === 'link' && resource.url && isSafeExternalUrl(resource.url)) {
            return `<a class="resource" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`
          }
          return `<div class="resource">${title}</div>`
        })
        .join('')}</div></section>`
    : ''

  return `<!doctype html>
<html lang="${uiLanguage() === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(lesson.title)}</title>
<style>
  :root{color-scheme:light dark}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;margin:0;background:#f8fafc;color:#0f172a}
  main{max-width:760px;margin:0 auto;padding:28px 18px 64px}header{padding:22px;border-radius:18px;background:#4f46e5;color:#fff;margin-bottom:16px}
  .eyebrow{font-size:.78rem;font-weight:700;opacity:.82;text-transform:uppercase;letter-spacing:.06em}h1{font-size:1.65rem;margin:7px 0 0}section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-top:12px}
  h2{font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 8px}.body{line-height:1.6;white-space:normal}.resources{display:grid;gap:8px}
  .resource{display:block;padding:11px 12px;border:1px solid #e2e8f0;border-radius:10px;color:#4338ca;text-decoration:none;background:#f8fafc}
  @media(prefers-color-scheme:dark){body{background:#0b1120;color:#e5e7eb}section{background:#111827;border-color:#263042}.resource{background:#1a2332;border-color:#263042;color:#a5b4fc}h2{color:#94a3b8}}
</style></head><body><main>
<header><div class="eyebrow">${escapeHtml(tr("Today's lesson"))}</div><h1>${escapeHtml(lesson.title)}</h1></header>
${sectionHtml}${resourceHtml}
</main></body></html>`
}

export function openClassroomHub(classId: string, lessonId: string): ClassroomHubStatus {
  const lesson = getLessonPlan(lessonId)
  if (!lesson || lesson.classId !== classId) {
    return { open: false, lessonId: null, title: null, url: null }
  }
  startExitTicketServer()
  openClassroomHubs.set(classId, lessonId)
  return getClassroomHubStatus(classId)
}

export function closeClassroomHub(classId: string): ClassroomHubStatus {
  openClassroomHubs.delete(classId)
  return getClassroomHubStatus(classId)
}

export function getClassroomHubStatus(classId: string): ClassroomHubStatus {
  const lessonId = openClassroomHubs.get(classId) ?? null
  const lesson = lessonId ? getLessonPlan(lessonId) : undefined
  const info = getExitTicketServerInfo()
  return {
    open: !!lesson && lesson.classId === classId,
    lessonId: lesson?.id ?? null,
    title: lesson?.title ?? null,
    url: lesson && info.url ? `${info.url}/h/${encodeURIComponent(classId)}` : null
  }
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      body += chunk.toString('utf-8')
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

export function startExitTicketServer(): void {
  if (server) return

  const s = createServer((req, res) => {
    // Collapse any accidental repeated slashes (e.g. a trailing-slash page path plus the
    // client's `pathname + '/submit'`) before routing, so a stray "//" never 404s a
    // genuine request.
    const url = (req.url ?? '/').replace(/\/{2,}/g, '/')

    const hubMatch = url.match(/^\/h\/([^/]+)\/?$/)
    if (hubMatch) {
      if (req.method === 'GET') {
        const classId = decodeURIComponent(hubMatch[1])
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderClassroomHubPage(classId))
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' })
        res.end('Method not allowed')
      }
      return
    }

    const checkInMatch = url.match(/^\/a\/([^/]+)(\/checkin)?\/?$/)
    if (checkInMatch) {
      const classId = decodeURIComponent(checkInMatch[1])
      const isCheckIn = !!checkInMatch[2]

      if (isCheckIn && req.method === 'POST') {
        if (tooManyTries(req)) {
          res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end(tr('Too many tries. Wait a minute, then try again.'))
          return
        }
        const device = deviceId(req)
        readBody(req)
          .then((raw) => {
            const session = openCheckIns.get(classId)
            if (!session) {
              res.writeHead(403, { 'Content-Type': 'text/plain' })
              res.end(tr('This check-in session is closed.'))
              return
            }
            let parsed: { studentId?: unknown }
            try {
              parsed = JSON.parse(raw)
            } catch {
              res.writeHead(400, { 'Content-Type': 'text/plain' })
              res.end('Bad request')
              return
            }
            const studentId = typeof parsed.studentId === 'string' ? parsed.studentId : ''
            const roster = getRosterForClass(classId)
            if (!studentId || !roster.some((r) => r.student.id === studentId)) {
              res.writeHead(400, { 'Content-Type': 'text/plain' })
              res.end('Unknown student')
              return
            }
            if (!device) {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end(tr('Open the check-in page again from the QR code, then tap your name.'))
              return
            }
            const already = session.studentByDevice.get(device)
            if (already && already !== studentId) {
              const who = roster.find((r) => r.student.id === already)
              res.writeHead(409, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end(
                tr(
                  'This device already checked in {name}. Each student checks in on their own device; ask your teacher if that’s wrong.',
                  { name: who ? rosterName(who.student) : tr('someone') }
                )
              )
              return
            }
            markAttendance({ classId, studentId, date: session.date, status: 'present' })
            session.checkedInStudentIds.add(studentId)
            session.studentByDevice.set(device, studentId)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end('{"ok":true}')
          })
          .catch(() => {
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('Bad request')
          })
        return
      }

      if (!isCheckIn && req.method === 'GET') {
        ensureDeviceCookie(req, res)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderAttendancePage(classId))
        return
      }

      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method not allowed')
      return
    }

    const match = url.match(/^\/t\/([^/]+)(\/submit)?\/?$/)

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }

    const classId = decodeURIComponent(match[1])
    const isSubmit = !!match[2]

    if (isSubmit && req.method === 'POST') {
      if (tooManyTries(req)) {
        res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end(tr('Too many tries. Wait a minute, then try again.'))
        return
      }
      readBody(req)
        .then((raw) => {
          const ticket = getExitTicketByClass(classId)
          if (!ticket || !isAcceptingResponses(ticket)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' })
            res.end(tr('This exit ticket is closed.'))
            return
          }
          let parsed: { studentId?: unknown; studentName?: unknown; answers?: unknown }
          try {
            parsed = JSON.parse(raw)
          } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('Bad request')
            return
          }
          // With a roster, the name must be one of its students (the id is checked
          // against the class, never trusted); without one, a typed name is accepted.
          const roster = activeRoster(classId)
          let studentId: string | null = null
          let studentName = ''
          if (roster.length) {
            const picked = roster.find((r) => r.id === parsed.studentId)
            if (!picked) {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end(tr('Choose your name from the list.'))
              return
            }
            studentId = picked.id
            studentName = picked.name
          } else if (typeof parsed.studentName === 'string') {
            studentName = parsed.studentName.trim().slice(0, 200)
          }
          const rawAnswers =
            parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {}
          const answers: Record<string, string> = {}
          for (const [key, value] of Object.entries(rawAnswers as Record<string, unknown>)) {
            if (typeof value === 'string') answers[key] = value.slice(0, 2000)
          }
          if (!studentName || Object.keys(answers).length === 0) {
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('Missing name or answers')
            return
          }
          submitExitTicketResponse({ exitTicketId: ticket.id, studentName, studentId, answers })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"ok":true}')
        })
        .catch(() => {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Bad request')
        })
      return
    }

    if (!isSubmit && req.method === 'GET') {
      ensureDeviceCookie(req, res)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderPage(classId))
      return
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method not allowed')
  })

  server = s
  tryListen(s, 0)
}

// All bind-error handling — including logging — lives in the single `once('error', ...)`
// listener attached per attempt below. A previous version also kept a persistent
// `on('error', ...)` logger alongside it, so a single EADDRINUSE fired both and logged
// twice; that persistent listener is gone now; each attempt logs at most once, either
// silently retrying (still within candidates) or reporting the final failure.
function tryListen(s: Server, portIndex: number): void {
  const port = CANDIDATE_PORTS[portIndex]
  if (port === undefined) {
    console.error('Exit ticket server: no available port among candidates')
    // Give up this attempt entirely so a later startExitTicketServer() call (e.g. after
    // whatever was holding the ports frees up) can retry instead of no-op'ing forever.
    s.removeAllListeners()
    if (server === s) server = null
    return
  }
  const onError = (err: NodeJS.ErrnoException): void => {
    if (err.code === 'EADDRINUSE' && portIndex + 1 < CANDIDATE_PORTS.length) {
      tryListen(s, portIndex + 1)
      return
    }
    console.error('Exit ticket server error:', err)
    if (server === s) server = null
  }
  s.once('error', onError)
  // Bind to all interfaces (0.0.0.0), not just localhost — student devices on the
  // classroom WiFi need to reach it via the teacher's LAN IP.
  s.listen(port, '0.0.0.0', () => {
    s.off('error', onError)
    boundPort = port
    // A late bind error after this point (e.g. the OS closing the socket under us) is
    // rare but real — keep a persistent logger for the server's remaining lifetime,
    // attached only once we're actually listening so it never overlaps a retry attempt.
    s.on('error', (err) => console.error('Exit ticket server error:', err))
  })
}

export function stopExitTicketServer(): void {
  server?.close()
  server = null
  boundPort = null
  openCheckIns.clear()
  openClassroomHubs.clear()
  recentSubmits.clear()
}

export function getExitTicketServerInfo(): ExitTicketServerInfo {
  const lanIp = getLanIp()
  const running = !!server && boundPort !== null
  return {
    running,
    port: boundPort,
    lanIp,
    url: running && lanIp ? `http://${lanIp}:${boundPort}` : null
  }
}
