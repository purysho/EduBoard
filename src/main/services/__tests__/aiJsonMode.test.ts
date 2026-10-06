import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../repositories/settingsRepo', () => ({
  getSettings: () => ({
    aiProvider: 'zhipu',
    aiApiKey: 'test-key',
    aiCustomBaseUrl: '',
    aiCustomModel: '',
    aiModel: 'glm-4.7-flash'
  })
}))

import {
  askAi,
  draftLessonPlan,
  draftUnitPlan,
  fieldText,
  modelFor,
  parseJsonReply
} from '../aiService'

afterEach(() => {
  vi.unstubAllGlobals()
})

const reply = (status: number, content = '{"items": []}'): Response =>
  new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content } }] } : {}), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('JSON mode and the chosen model', () => {
  it('asks for JSON mode with the chosen model', async () => {
    const fetch = vi.fn(async () => reply(200))
    vi.stubGlobal('fetch', fetch)
    await askAi('system', 'user', 100, { json: true })
    const body = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    )
    expect(body.model).toBe('glm-4.7-flash')
    expect(body.response_format).toEqual({ type: 'json_object' })
  })

  it('asks again without JSON mode when the provider refuses it', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(400)).mockResolvedValueOnce(reply(200))
    vi.stubGlobal('fetch', fetch)
    expect(await askAi('system', 'user', 100, { json: true })).toBe('{"items": []}')
    const second = JSON.parse(
      (fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string
    )
    expect(second.response_format).toBeUndefined()
  })

  it('plain text requests never ask for JSON mode', async () => {
    const fetch = vi.fn(async () => reply(200, 'Hello'))
    vi.stubGlobal('fetch', fetch)
    await askAi('system', 'user', 100)
    const body = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    )
    expect(body.response_format).toBeUndefined()
  })

  it('a custom provider keeps its own model; a blank choice keeps the default', () => {
    const base = { apiKey: 'k', customBaseUrl: 'http://x', customModel: 'llama3.1' }
    expect(modelFor({ ...base, provider: 'custom', model: 'ignored' })).toBe('llama3.1')
    expect(modelFor({ ...base, provider: 'zhipu', model: '  ' })).toBe('glm-4-flash-250414')
  })

  it('drafts a unit in JSON mode and keeps only the lessons asked for', async () => {
    const unit = {
      title: 'News',
      prerequisites: ['Past simple'],
      lessons: [{ title: 'A' }, { title: 'B' }, { title: 'C' }]
    }
    const fetch = vi.fn(async () => reply(200, '```json\n' + JSON.stringify(unit) + '\n```'))
    vi.stubGlobal('fetch', fetch)
    const plan = await draftUnitPlan({
      classId: 'c1',
      className: 'English 1',
      subject: null,
      gradeLevel: null,
      topic: 'News',
      lessonCount: 2
    })
    expect(plan.lessons.map((l) => l.title)).toEqual(['A', 'B'])
    const body = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    )
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(JSON.stringify(body.messages)).toContain('Number of lessons: 2')
  })

  it('reads JSON wrapped in a sentence or a fence, and says so plainly when there is none', () => {
    expect(parseJsonReply('Here is your plan:\n{"title": "A"}\nGood luck!')).toEqual({ title: 'A' })
    expect(parseJsonReply('```json\n{"title": "B"}\n```')).toEqual({ title: 'B' })
    expect(() => parseJsonReply('Sorry, I cannot help with that.')).toThrow(
      'The AI reply could not be read. Try again.'
    )
    expect(() => parseJsonReply('[1, 2]')).toThrow('could not be read')
  })

  it('turns lists the model sent instead of text into "- " lines', () => {
    expect(fieldText(['Warm-up (5): greet', '- Pair work (10)'])).toBe(
      '- Warm-up (5): greet\n- Pair work (10)'
    )
    expect(fieldText([{ step: 'Warm-up', minutes: 5 }])).toBe('- Warm-up: 5')
    expect(fieldText(null)).toBe('')
  })

  it('drafts a lesson from a reply with prose around it and lists for fields', async () => {
    const body = {
      title: 'Clubs',
      objectives: ['Ask about clubs', 'Say what I like'],
      materials: 'Cards',
      activities: ['Warm-up (5): chant', 'Pairs (15): interview'],
      support: 'Sentence frames',
      stretch: 'Follow-up questions',
      homework: ''
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply(200, 'Sure! Here it is:\n' + JSON.stringify(body)))
    )
    const plan = await draftLessonPlan({
      className: 'English 1',
      subject: null,
      gradeLevel: null,
      topic: 'Clubs'
    })
    expect(plan.objectives).toBe('- Ask about clubs\n- Say what I like')
    expect(plan.activities).toBe('- Warm-up (5): chant\n- Pairs (15): interview')
    expect(plan.support).toBe('Sentence frames')
  })

  it('gives provider failures and empty units in plain words', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply(429))
    )
    const input = {
      classId: 'c1',
      className: 'English 1',
      subject: null,
      gradeLevel: null,
      topic: 'News',
      lessonCount: 2
    }
    await expect(draftUnitPlan(input)).rejects.toThrow(/out of quota or rate-limited/)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply(200, '{"title": "News", "lessons": []}'))
    )
    await expect(draftUnitPlan(input)).rejects.toThrow('The AI reply had no lessons in it.')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        reply(200, '{"lessons": [{"title": "A", "objectives": ["one", "two"], "check": "Quiz"}]}')
      )
    )
    expect((await draftUnitPlan(input)).lessons[0].objectives).toBe('one; two')
  })
})
