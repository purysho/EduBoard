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
import { createLessonPlan, linkLessonResource } from '../../repositories/lessonPlans'
import {
  createLessonResource,
  setLessonResourceAiApproval,
  setLessonResourcePracticeSet
} from '../../repositories/lessonResources'
import {
  getClassroomHubProjectorUrl,
  getExitTicketServerInfo,
  closeAttendanceCheckIn,
  closeClassroomHub,
  closeExitTicketSession,
  exitTicketStudentUrl,
  getAttendanceCheckInStatus,
  openAttendanceCheckIn,
  openClassroomHub,
  openExitTicketSession,
  overSubmitLimit,
  sessionPath,
  startExitTicketServer,
  stopExitTicketServer,
  stopExitTicketServerIfIdle
} from '../exitTicketServer'
import { updateSettings } from '../../repositories/settingsRepo'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
  startExitTicketServer()
})

afterEach(() => {
  // Each test starts with no tool open (sessions live in the server module).
  stopExitTicketServer()
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
  it('serves Classroom Hub to the same computer for projector mode', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const lesson = createLessonPlan({
      classId,
      date: '2026-09-30',
      weekLabel: 'Week 1',
      title: 'Projector lesson',
      objectives: 'Speak with a partner.',
      framework: null,
      materials: null,
      activities: 'Ask and answer two questions.',
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })

    expect(openClassroomHub(classId, lesson.id).open).toBe(true)
    const projectorUrl = getClassroomHubProjectorUrl(classId)
    expect(projectorUrl).toBe(`${base}${sessionPath('h', classId)}`)
    expect(projectorUrl).toMatch(/\/k\/[a-f0-9]{32}\/h\//)

    const page = await fetch(projectorUrl!)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('Projector lesson')
  })

  it('serves approved flashcards and quizzes from linked resources without internet', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const lesson = createLessonPlan({
      classId,
      date: '2026-09-30',
      weekLabel: null,
      title: 'Offline practice lesson',
      objectives: null,
      framework: null,
      materials: null,
      activities: 'Review museum vocabulary.',
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    const resource = createLessonResource({
      title: 'Museum words',
      type: 'note',
      url: null,
      filePath: null,
      notes: 'Review these words.',
      tags: [],
      standardId: null,
      classId,
      shareWithStudents: true,
      studyGuide: null
    })
    setLessonResourcePracticeSet(resource.id, 'flashcards', [
      { front: 'Exhibit', back: 'Something shown in a museum.' },
      { front: 'Ancient', back: 'Very old.' },
      { front: 'Collection', back: 'A group of things.' },
      { front: 'Gallery', back: 'A room where things are shown.' }
    ])
    setLessonResourcePracticeSet(resource.id, 'quiz', [
      {
        question: 'What is an exhibit?',
        options: ['Something shown', 'A bus'],
        answerIndex: 0,
        explanation: 'An exhibit is something shown to visitors.'
      },
      {
        question: 'What does ancient mean?',
        options: ['Very new', 'Very old'],
        answerIndex: 1,
        explanation: 'Ancient means very old.'
      },
      {
        question: 'What is a collection?',
        options: ['A group of things', 'One thing only'],
        answerIndex: 0,
        explanation: 'A collection is a group of things.'
      }
    ])
    setLessonResourceAiApproval(resource.id, 'flashcards', true)
    setLessonResourceAiApproval(resource.id, 'practiceQuiz', true)
    linkLessonResource(lesson.id, resource.id)
    openClassroomHub(classId, lesson.id)

    const hub = await (await fetch(`${base}${sessionPath('h', classId)}`)).text()
    expect(hub).toContain('/flashcards')
    expect(hub).toContain('/quiz')

    const cards = await (
      await fetch(`${base}${sessionPath('h', classId)}/practice/${resource.id}/flashcards`)
    ).text()
    expect(cards).toContain('Exhibit')
    expect(cards).toContain('Show answer')

    const quiz = await (
      await fetch(`${base}${sessionPath('h', classId)}/practice/${resource.id}/quiz`)
    ).text()
    expect(quiz).toContain('What is an exhibit?')
    expect(quiz).toContain('Question ')
  })

  it('has no link for a class with no exit ticket open', async () => {
    await waitForServer()
    const classId = makeClass()
    expect(sessionPath('t', classId)).toBeNull()
    expect(exitTicketStudentUrl(classId)).toBeNull()
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
    openExitTicketSession(classId)

    const page = await fetch(`${base}${sessionPath('t', classId)}`)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('What did you learn?')
    expect(html).toContain('Today&#39;s Exit Ticket')

    const submitRes = await fetch(`${base}${sessionPath('t', classId)}/submit`, {
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
    const rejected = await fetch(`${base}${sessionPath('t', classId)}/submit`, {
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
    openExitTicketSession(classId)

    const res = await fetch(`${base}${sessionPath('t', classId)}/submit`, {
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
    openExitTicketSession(classId)

    const html = await (await fetch(`${base}${sessionPath('t', classId)}`)).text()
    expect(html).toContain('<select')
    expect(html).toContain(`value="${ada}"`)
    expect(html).toContain('Bob Test')

    // A made-up id or a bare typed name isn't accepted once there's a roster.
    expect(
      (
        await post(`${base}${sessionPath('t', classId)}/submit`, {
          studentId: 'nope',
          answers: { q1: 'x' }
        })
      ).status
    ).toBe(400)
    expect(
      (
        await post(`${base}${sessionPath('t', classId)}/submit`, {
          studentName: 'Ada',
          answers: { q1: 'x' }
        })
      ).status
    ).toBe(400)

    expect(
      (
        await post(`${base}${sessionPath('t', classId)}/submit`, {
          studentId: ada,
          answers: { q1: 'First' }
        })
      ).status
    ).toBe(200)
    expect(
      (
        await post(`${base}${sessionPath('t', classId)}/submit`, {
          studentId: ada,
          answers: { q1: 'Second' }
        })
      ).status
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
    openExitTicketSession(classId)
    expect(opened.closesAt).not.toBeNull()
    expect(getExitTicketByClass(classId)?.isOpen).toBe(true)

    getDb()
      .update(exitTickets)
      .set({ closesAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(exitTickets.id, ticket.id))
      .run()
    const late = await post(`${base}${sessionPath('t', classId)}/submit`, {
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

    const page = await fetch(`${base}${sessionPath('a', classId)}`)
    const cookie = (page.headers.get('set-cookie') ?? '').split(';')[0]
    expect(cookie).toMatch(/^eb_device=[a-f0-9]{32}$/)

    expect(
      (await post(`${base}${sessionPath('a', classId)}/checkin`, { studentId: ada })).status
    ).toBe(400) // no cookie
    expect(
      (await post(`${base}${sessionPath('a', classId)}/checkin`, { studentId: ada }, cookie)).status
    ).toBe(200)
    expect(
      (await post(`${base}${sessionPath('a', classId)}/checkin`, { studentId: ada }, cookie)).status
    ).toBe(200) // again: fine
    const friend = await post(
      `${base}${sessionPath('a', classId)}/checkin`,
      { studentId: bob },
      cookie
    )
    expect(friend.status).toBe(409)
    expect(await friend.text()).toContain('already checked in Ada Test')

    const otherPhone = `eb_device=${'b'.repeat(32)}`
    expect(
      (await post(`${base}${sessionPath('a', classId)}/checkin`, { studentId: bob }, otherPhone))
        .status
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
          `${base}${sessionPath('a', classId)}/checkin`,
          { studentId: id },
          `eb_device=${i.toString(16).padStart(32, '0')}`
        ).then((r) => r.status)
      )
    )
    expect(statuses.every((st) => st === 200)).toBe(true)
  })

  it('refuses an unrelated path', async () => {
    const base = await waitForServer()
    const res = await fetch(`${base}/definitely-not-a-real-path`)
    expect(res.status).toBe(403)
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

describe('session links', () => {
  it('serves a page only with the token made for that tool and class', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const other = makeClass()
    makeStudent(classId, 'Ada')
    openAttendanceCheckIn(classId, '2026-09-28')
    openAttendanceCheckIn(other, '2026-09-28')
    const path = sessionPath('a', classId)!
    expect(path).toMatch(/^\/k\/[a-f0-9]{32}\/a\//)
    expect(getAttendanceCheckInStatus(classId).url).toBe(
      `${base.replace('127.0.0.1', getExitTicketServerInfo().lanIp ?? '127.0.0.1')}${path}`
    )

    expect((await fetch(`${base}${path}`)).status).toBe(200)
    // No token, a made-up one, or another class's token: refused, and no names shown.
    for (const wrong of [
      `/a/${classId}`,
      `/k/${'0'.repeat(32)}/a/${classId}`,
      sessionPath('a', other)!.replace(encodeURIComponent(other), encodeURIComponent(classId))
    ]) {
      const res = await fetch(`${base}${wrong}`)
      expect(res.status, wrong).toBe(403)
      expect(await res.text()).not.toContain('Ada')
    }
    // A token for check-in doesn't open the exit ticket or classroom screen.
    const token = path.split('/')[2]
    expect((await fetch(`${base}/k/${token}/t/${classId}`)).status).toBe(403)
    expect((await fetch(`${base}/k/${token}/h/${classId}`)).status).toBe(403)
  })

  it('makes a new link each time a tool opens, and the old one stops working', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'Q', type: 'text' }]
    })
    setExitTicketOpen(ticket.id, true)
    openExitTicketSession(classId)
    const first = sessionPath('t', classId)!
    expect((await fetch(`${base}${first}`)).status).toBe(200)

    openAttendanceCheckIn(makeClass(), '2026-09-28') // keeps the server up
    closeExitTicketSession(classId)
    expect(sessionPath('t', classId)).toBeNull()
    expect((await fetch(`${base}${first}`)).status).toBe(403)
    expect(
      (await post(`${base}${first}/submit`, { studentName: 'A', answers: { q1: 'x' } })).status
    ).toBe(403)

    openExitTicketSession(classId)
    const second = sessionPath('t', classId)!
    expect(second).not.toBe(first)
    expect((await fetch(`${base}${second}`)).status).toBe(200)
    expect((await fetch(`${base}${first}`)).status).toBe(403)
  })
})

describe('server shutdown', () => {
  const reachable = (url: string): Promise<boolean> =>
    fetch(url).then(
      () => true,
      () => false
    )

  it('stops when the last tool is closed, and serves nothing after', async () => {
    const base = await waitForServer()
    const classId = makeClass()
    const lesson = createLessonPlan({
      classId,
      date: '2026-09-30',
      weekLabel: null,
      title: 'Lesson',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })
    openAttendanceCheckIn(classId, '2026-09-28')
    openClassroomHub(classId, lesson.id)
    const checkIn = `${base}${sessionPath('a', classId)}`

    closeAttendanceCheckIn(classId)
    expect(getExitTicketServerInfo().running).toBe(true) // the classroom screen is still open
    closeClassroomHub(classId)
    expect(getExitTicketServerInfo()).toMatchObject({ running: false, port: null, url: null })
    expect(await reachable(checkIn)).toBe(false)
  })

  it('stays up while an exit ticket takes answers, and stops once its time is up', async () => {
    await waitForServer()
    const classId = makeClass()
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'Q', type: 'text' }]
    })
    setExitTicketOpen(ticket.id, true, 10)
    openExitTicketSession(classId)
    expect(stopExitTicketServerIfIdle()).toBe(false)
    expect(getExitTicketServerInfo().running).toBe(true)

    getDb()
      .update(exitTickets)
      .set({ closesAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(exitTickets.id, ticket.id))
      .run()
    expect(stopExitTicketServerIfIdle()).toBe(true) // what the half-minute check does
    expect(getExitTicketServerInfo().running).toBe(false)
  })

  it('stops with nothing open', async () => {
    await waitForServer()
    expect(stopExitTicketServerIfIdle()).toBe(true)
    expect(getExitTicketServerInfo().running).toBe(false)
  })
})

describe('names on shared screens', () => {
  async function checkInPage(): Promise<string> {
    const base = await waitForServer()
    const classId = makeClass()
    const id = createStudent({
      firstName: 'Xanthippe',
      lastName: 'Quillfeather',
      preferredName: null,
      studentNumber: 'SYN-042',
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    }).id
    enrollStudent({ studentId: id, classId, enrolledOn: '2026-09-01' })
    openAttendanceCheckIn(classId, '2026-09-28')
    return (await fetch(`${base}${sessionPath('a', classId)}`)).text()
  }

  it('shows full names by default outside a pilot', async () => {
    expect(await checkInPage()).toContain('Xanthippe Quillfeather')
  })

  it('shows first name and last initial by default in a pilot', async () => {
    updateSettings({ pilotMode: true })
    const html = await checkInPage()
    expect(html).toContain('Xanthippe Q.')
    expect(html).not.toContain('Quillfeather')
  })

  it('shows only the student number when chosen', async () => {
    updateSettings({ sharedScreenNames: 'number' })
    const html = await checkInPage()
    expect(html).toContain('SYN-042')
    expect(html).not.toContain('Xanthippe')
  })

  it('keeps the full name in the teacher’s exit ticket results', async () => {
    updateSettings({ sharedScreenNames: 'firstInitial' })
    const base = await waitForServer()
    const classId = makeClass()
    const ada = makeStudent(classId, 'Ada')
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'Q', type: 'text' }]
    })
    setExitTicketOpen(ticket.id, true)
    openExitTicketSession(classId)
    const html = await (await fetch(`${base}${sessionPath('t', classId)}`)).text()
    expect(html).toContain('Ada T.')
    expect(html).not.toContain('Ada Test')
    await post(`${base}${sessionPath('t', classId)}/submit`, {
      studentId: ada,
      answers: { q1: 'x' }
    })
    expect(listExitTicketResponses(ticket.id)[0].studentName).toBe('Ada Test')
  })
})
