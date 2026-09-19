import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'http'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import {
  listExitTicketResponses,
  setExitTicketOpen,
  upsertExitTicket
} from '../../repositories/exitTickets'
import {
  getExitTicketServerInfo,
  startExitTicketServer,
  stopExitTicketServer
} from '../exitTicketServer'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
  startExitTicketServer()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

afterAll(() => {
  stopExitTicketServer()
})

function makeClass(): string {
  return createClass({
    name: 'Grade 5',
    subject: null,
    levelType: 'k12',
    gradeLevel: null,
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id
}

async function waitForServer(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const info = getExitTicketServerInfo()
    if (info.running && info.port) return `http://127.0.0.1:${info.port}`
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('exit ticket server never came up')
}

describe('exit ticket local HTTP server', () => {
  it('serves a "closed" page when no ticket is open for the class', async () => {
    const base = await waitForServer()
    const classId = makeClass()

    const res = await fetch(`${base}/t/${classId}`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('No exit ticket is open')
  })

  it('serves the question page once open, accepts a submission, and rejects once closed', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ticket = upsertExitTicket({
      classId,
      title: "Today's Exit Ticket",
      questions: [{ id: 'q1', prompt: 'What did you learn?', type: 'text' }]
    })
    setExitTicketOpen(ticket.id, true)

    const page = await fetch(`${base}/t/${classId}`)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('What did you learn?')
    expect(html).toContain('Today&#39;s Exit Ticket')

    const submitRes = await fetch(`${base}/t/${classId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Ada', answers: { q1: 'Fractions' } })
    })
    expect(submitRes.status).toBe(200)

    const responses = listExitTicketResponses(ticket.id)
    expect(responses).toHaveLength(1)
    expect(responses[0].studentName).toBe('Ada')
    expect(responses[0].answers.q1).toBe('Fractions')

    setExitTicketOpen(ticket.id, false)
    const rejected = await fetch(`${base}/t/${classId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Bob', answers: { q1: 'Late submission' } })
    })
    expect(rejected.status).toBe(403)
    expect(listExitTicketResponses(ticket.id)).toHaveLength(1) // unchanged
  })

  it('rejects a submission with no name or empty answers', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'What did you learn?', type: 'text' }]
    })
    setExitTicketOpen(ticket.id, true)

    const res = await fetch(`${base}/t/${classId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: '', answers: {} })
    })
    expect(res.status).toBe(400)
    expect(listExitTicketResponses(ticket.id)).toHaveLength(0)
  })

  it('404s on an unrelated path', async () => {
    const base = await waitForServer()
    const res = await fetch(`${base}/definitely-not-a-real-path`)
    expect(res.status).toBe(404)
  })

  it('logs an EADDRINUSE retry at most once, not once per listener', async () => {
    // The real server (started in beforeEach) is already bound to the first candidate
    // port. Occupy the exact same port with a throwaway server, then start a second
    // real exit-ticket server so it has to retry past that port — this is exactly the
    // scenario a previous version double-logged (a persistent `on('error')` handler
    // plus a retry-specific `once('error')` handler both firing for one EADDRINUSE).
    const info = await waitForServer()
    const occupiedPort = Number(new URL(info).port)
    stopExitTicketServer()

    const blocker = createServer()
    await new Promise<void>((resolve) => blocker.listen(occupiedPort, '0.0.0.0', resolve))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      startExitTicketServer()
      await waitForServer()
      const eaddrinuseLogs = errorSpy.mock.calls.filter(
        (call) => String(call[1]?.code ?? call[1]) === 'EADDRINUSE'
      )
      expect(eaddrinuseLogs).toHaveLength(0) // a mid-retry EADDRINUSE is never logged at all
    } finally {
      errorSpy.mockRestore()
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })
})
