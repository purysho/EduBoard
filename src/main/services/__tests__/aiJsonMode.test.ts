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

import { askAi, draftUnitPlan, modelFor } from '../aiService'

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
})
