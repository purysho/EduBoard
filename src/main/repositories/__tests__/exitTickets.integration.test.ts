import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../classes'
import {
  clearExitTicketResponses,
  getExitTicketByClass,
  listExitTicketResponses,
  setExitTicketOpen,
  submitExitTicketResponse,
  upsertExitTicket
} from '../exitTickets'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
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

describe('exit tickets', () => {
  it('creates one exit ticket per class and updates it in place on re-save', () => {
    const classId = makeClass()

    const first = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'What did you learn?', type: 'text' }]
    })
    expect(first.isOpen).toBe(false)
    expect(first.questions).toHaveLength(1)

    const second = upsertExitTicket({
      classId,
      title: 'Updated title',
      questions: [
        { id: 'q1', prompt: 'What did you learn?', type: 'text' },
        { id: 'q2', prompt: 'Confidence?', type: 'choice', options: ['High', 'Low'] }
      ]
    })
    // Same underlying row (one ticket per class), not a duplicate.
    expect(second.id).toBe(first.id)
    expect(second.title).toBe('Updated title')
    expect(second.questions).toHaveLength(2)
    expect(getExitTicketByClass(classId)?.id).toBe(first.id)
  })

  it('records responses, toggles open state, and clears responses on demand', () => {
    // The isOpen gate on who's allowed to submit lives in the HTTP server layer
    // (services/exitTicketServer.ts), not here — this only checks the repository's
    // own storage/retrieval/toggle behavior.
    const classId = makeClass()
    const ticket = upsertExitTicket({
      classId,
      title: 'Exit Ticket',
      questions: [{ id: 'q1', prompt: 'What did you learn?', type: 'text' }]
    })

    const opened = setExitTicketOpen(ticket.id, true)
    expect(opened.isOpen).toBe(true)

    submitExitTicketResponse({
      exitTicketId: ticket.id,
      studentName: 'Ada',
      answers: { q1: 'Fractions' }
    })
    submitExitTicketResponse({
      exitTicketId: ticket.id,
      studentName: 'Bob',
      answers: { q1: 'Photosynthesis' }
    })
    const responses = listExitTicketResponses(ticket.id)
    expect(responses).toHaveLength(2)
    expect(responses.map((r) => r.studentName)).toEqual(['Ada', 'Bob'])

    clearExitTicketResponses(ticket.id)
    expect(listExitTicketResponses(ticket.id)).toHaveLength(0)

    const closed = setExitTicketOpen(ticket.id, false)
    expect(closed.isOpen).toBe(false)
  })
})
