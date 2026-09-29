import { describe, expect, it } from 'vitest'
import { confidenceQuestion, summarizeExitTicket } from '../exitTicketSummary'
import type { ExitTicketQuestion, ExitTicketResponse } from '../types'

const respond = (answers: Record<string, string>[]): ExitTicketResponse[] =>
  answers.map((a, i) => ({
    id: String(i),
    exitTicketId: 't',
    studentName: `S${i}`,
    studentId: null,
    answers: a,
    submittedAt: '2026-10-01T09:00:00Z'
  })) as ExitTicketResponse[]

describe('exit ticket summary', () => {
  const check: ExitTicketQuestion = {
    id: 'q1',
    prompt: 'Which sentence hedges?',
    type: 'choice',
    options: ['X caused Y', 'X may have contributed to Y'],
    goodOptions: [1]
  }

  it('suggests re-teaching when fewer than 70% show understanding', () => {
    const [s] = summarizeExitTicket(
      [check],
      respond([{ q1: 'X caused Y' }, { q1: 'X caused Y' }, { q1: 'X may have contributed to Y' }])
    )
    expect(s.options.map((o) => o.count)).toEqual([2, 1])
    expect(s.understood).toBeCloseTo(1 / 3)
    expect(s.reteach).toBe(true)
  })

  it('makes no suggestion with too few answers, or when nothing is marked', () => {
    expect(summarizeExitTicket([check], respond([{ q1: 'X caused Y' }]))[0].reteach).toBe(false)
    const unmarked = { ...check, goodOptions: undefined }
    const [s] = summarizeExitTicket([unmarked], respond([{ q1: 'X caused Y' }]))
    expect(s.understood).toBeNull()
  })

  it('collects short answers and counts the confidence check’s first two options', () => {
    const conf = confidenceQuestion('c')
    const text: ExitTicketQuestion = { id: 't1', prompt: 'One thing you learned', type: 'text' }
    const [c, t] = summarizeExitTicket(
      [conf, text],
      respond([
        { c: conf.options![0], t1: 'Hedging' },
        { c: conf.options![1], t1: '  ' },
        { c: conf.options![3] },
        { c: conf.options![0] }
      ])
    )
    expect(c.understood).toBe(0.75)
    expect(c.reteach).toBe(false)
    expect(t.texts).toEqual(['Hedging'])
  })
})
