import { createServer, type Server } from 'http'
import { networkInterfaces } from 'os'
import { getExitTicketByClass, submitExitTicketResponse } from '../repositories/exitTickets'
import type { ExitTicketServerInfo } from '@shared/types'

// Fixed port with a few fallbacks in case something else on the machine already holds
// it. Never anything but a plain loopback-adjacent LAN port — this server is meant to
// be reachable only from devices on the same classroom WiFi, never the internet.
const CANDIDATE_PORTS = [51820, 51821, 51822, 51823]

let server: Server | null = null
let boundPort: number | null = null

function getLanIp(): string | null {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
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

  if (!ticket || !ticket.isOpen) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Exit Ticket</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#475569;text-align:center;padding:24px}</style>
</head><body><p>No exit ticket is open right now. Ask your teacher.</p></body></html>`
  }

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
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ticket.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
  .wrap{max-width:480px;margin:0 auto;padding:24px 16px}
  h1{font-size:1.25rem;margin:0 0 20px}
  .question{margin-bottom:20px}
  .q{display:block;font-weight:600;margin-bottom:8px}
  .qn{color:#6366f1}
  textarea{width:100%;min-height:70px;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;resize:vertical}
  input[type=text]{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
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
      <label class="q">Your name</label>
      <input type="text" name="_name" required>
    </div>
    ${questionsHtml}
    <button type="submit">Submit</button>
  </form>
  <div id="done">Thanks — your answers were submitted.</div>
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
    body: JSON.stringify({ studentName: data.get('_name'), answers: answers })
  }).then(function (res) {
    if (res.ok) {
      document.getElementById('f').style.display = 'none'
      document.getElementById('done').style.display = 'block'
    } else {
      btn.disabled = false
      alert('Something went wrong — please try again.')
    }
  }).catch(function () {
    btn.disabled = false
    alert('Could not submit — check you are still on the classroom WiFi and try again.')
  })
})
</script>
</body></html>`
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
    const url = req.url ?? '/'
    const match = url.match(/^\/t\/([^/]+)(\/submit)?\/?$/)

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }

    const classId = decodeURIComponent(match[1])
    const isSubmit = !!match[2]

    if (isSubmit && req.method === 'POST') {
      readBody(req)
        .then((raw) => {
          const ticket = getExitTicketByClass(classId)
          if (!ticket || !ticket.isOpen) {
            res.writeHead(403, { 'Content-Type': 'text/plain' })
            res.end('This exit ticket is closed.')
            return
          }
          let parsed: { studentName?: unknown; answers?: unknown }
          try {
            parsed = JSON.parse(raw)
          } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('Bad request')
            return
          }
          const studentName =
            typeof parsed.studentName === 'string' ? parsed.studentName.trim().slice(0, 200) : ''
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
          submitExitTicketResponse({ exitTicketId: ticket.id, studentName, answers })
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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderPage(classId))
      return
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method not allowed')
  })

  s.on('error', (err) => {
    console.error('Exit ticket server error:', err)
  })

  tryListen(s, 0)
  server = s
}

function tryListen(s: Server, portIndex: number): void {
  const port = CANDIDATE_PORTS[portIndex]
  if (port === undefined) {
    console.error('Exit ticket server: no available port among candidates')
    return
  }
  // Bind to all interfaces (0.0.0.0), not just localhost — student devices on the
  // classroom WiFi need to reach it via the teacher's LAN IP.
  s.listen(port, '0.0.0.0', () => {
    boundPort = port
  })
  s.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && portIndex + 1 < CANDIDATE_PORTS.length) {
      tryListen(s, portIndex + 1)
    }
  })
}

export function stopExitTicketServer(): void {
  server?.close()
  server = null
  boundPort = null
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
