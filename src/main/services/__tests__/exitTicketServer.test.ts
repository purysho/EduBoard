import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'http'
import { eq } from 'drizzle-orm'
import { closeDb, getDb, initDb, setDbPathForTesting } from '../../db/client'
import { exitTickets } from '../../db/schema'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import {
  getExitTicketByClass,
  listExitTicketResponses,
  setExitTicketOpen,
  upsertExitTicket
} from '../../repositories/exitTickets'
import { listAttendanceByClass } from '../../repositories/attendanceRecords'
import {
  getExitTicketServerInfo,
  openAttendanceCheckIn,
  overSubmitLimit,
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

function makeStudent(classId: string, firstName: string): string {
  const id = createStudent({
    firstName,
    lastName: 'Test',
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  }).id
  enrollStudent({ studentId: id, classId, enrolledOn: '2026-09-01' })
  return id
}

const post = (url: string, body: unknown, cookie?: string): Promise<Response> =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body)
  })

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

  it('has students pick their name from the roster, and a second answer replaces the first', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ada = makeStudent(classId, 'Ada')
    makeStudent(classId, 'Bob')
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'What did you learn?', type: 'text' }]
    })
    setExitTicketOpen(ticket.id, true)

    const html = await (await fetch(`${base}/t/${classId}`)).text()
    expect(html).toContain('<select')
    expect(html).toContain(`value="${ada}"`)
    expect(html).toContain('Bob Test')

    // A made-up id or a bare typed name isn't accepted once there's a roster.
    expect(
      (await post(`${base}/t/${classId}/submit`, { studentId: 'nope', answers: { q1: 'x' } }))
        .status
    ).toBe(400)
    expect(
      (await post(`${base}/t/${classId}/submit`, { studentName: 'Ada', answers: { q1: 'x' } }))
        .status
    ).toBe(400)

    expect(
      (await post(`${base}/t/${classId}/submit`, { studentId: ada, answers: { q1: 'First' } }))
        .status
    ).toBe(200)
    expect(
      (await post(`${base}/t/${classId}/submit`, { studentId: ada, answers: { q1: 'Second' } }))
        .status
    ).toBe(200)
    const responses = listExitTicketResponses(ticket.id)
    expect(responses).toHaveLength(1)
    expect(responses[0]).toMatchObject({ studentId: ada, studentName: 'Ada Test' })
    expect(responses[0].answers.q1).toBe('Second')
  })

  it('closes a session by itself once its time is up', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'Q', type: 'text' }]
    })
    const opened = setExitTicketOpen(ticket.id, true, 10)
    expect(opened.closesAt).not.toBeNull()
    expect(getExitTicketByClass(classId)?.isOpen).toBe(true)

    getDb()
      .update(exitTickets)
      .set({ closesAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(exitTickets.id, ticket.id))
      .run()
    const late = await post(`${base}/t/${classId}/submit`, {
      studentName: 'Ada',
      answers: { q1: 'x' }
    })
    expect(late.status).toBe(403)
    expect(getExitTicketByClass(classId)).toMatchObject({ isOpen: false, closesAt: null })
  })

  it('lets each phone check in only one student', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ada = makeStudent(classId, 'Ada')
    const bob = makeStudent(classId, 'Bob')
    openAttendanceCheckIn(classId, '2026-09-28')

    const page = await fetch(`${base}/a/${classId}`)
    const cookie = (page.headers.get('set-cookie') ?? '').split(';')[0]
    expect(cookie).toMatch(/^eb_device=[a-f0-9]{32}$/)

    expect((await post(`${base}/a/${classId}/checkin`, { studentId: ada })).status).toBe(400) // no cookie
    expect((await post(`${base}/a/${classId}/checkin`, { studentId: ada }, cookie)).status).toBe(
      200
    )
    expect((await post(`${base}/a/${classId}/checkin`, { studentId: ada }, cookie)).status).toBe(
      200
    ) // again: fine
    const friend = await post(`${base}/a/${classId}/checkin`, { studentId: bob }, cookie)
    expect(friend.status).toBe(409)
    expect(await friend.text()).toContain('already checked in Ada Test')

    const otherPhone = `eb_device=${'b'.repeat(32)}`
    expect(
      (await post(`${base}/a/${classId}/checkin`, { studentId: bob }, otherPhone)).status
    ).toBe(200)
    const present = listAttendanceByClass(classId).filter((r) => r.status === 'present')
    expect(present.map((r) => r.studentId).sort()).toEqual([ada, bob].sort())
  })

  it('takes a whole class checking in from one network address', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ids = Array.from({ length: 30 }, (_, i) => makeStudent(classId, `S${i}`))
    openAttendanceCheckIn(classId, '2026-09-28')
    const statuses = await Promise.all(
      ids.map((id, i) =>
        post(
          `${base}/a/${classId}/checkin`,
          { studentId: id },
          `eb_device=${i.toString(16).padStart(32, '0')}`
        ).then((r) => r.status)
      )
    )
    expect(statuses.every((st) => st === 200)).toBe(true)
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

describe('submission limit', () => {
  it('allows a burst of tries, then refuses that key until a minute has passed', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 12; i++) expect(overSubmitLimit('device:a', 12, t0 + i)).toBe(false)
    expect(overSubmitLimit('device:a', 12, t0 + 100)).toBe(true)
    expect(overSubmitLimit('device:b', 12, t0 + 100)).toBe(false)
    expect(overSubmitLimit('device:a', 12, t0 + 61_000)).toBe(false)
  })
})
