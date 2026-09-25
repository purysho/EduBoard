import { afterEach, describe, expect, it, vi } from 'vitest'

// aiService reads saved settings for normal calls; the connection test never does,
// because it checks what's in the Settings form before it's saved.
vi.mock('../../repositories/settingsRepo', () => ({
  getSettings: () => {
    throw new Error('testConnection must not read saved settings')
  }
}))

import { describeAiFailure, modelFor, testConnection } from '../aiService'

const zhipu = { provider: 'zhipu' as const, apiKey: 'test-key', customBaseUrl: '', customModel: '' }

function mockFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AI connection test', () => {
  it('uses the free Zhipu model that the API still accepts', () => {
    // Bare "glm-4-flash" was dropped from Zhipu's accepted model list; the dated
    // GLM-4-Flash-250414 is the documented free, non-reasoning text model.
    expect(modelFor(zhipu)).toBe('glm-4-flash-250414')
  })

  it('sends the form values, not saved settings, and reports success', async () => {
    const fetch = mockFetch(200, { choices: [{ message: { content: 'OK' } }] })
    const result = await testConnection(zhipu)
    expect(result).toEqual({ ok: true, model: 'glm-4-flash-250414', reply: 'OK' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    expect(JSON.parse(init.body as string).model).toBe('glm-4-flash-250414')
  })

  it('explains a rejected key', async () => {
    mockFetch(401, { error: { code: '1000', message: '身份验证失败。' } })
    const result = await testConnection(zhipu)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/rejected the key/)
      expect(result.error).toContain('身份验证失败')
    }
  })

  it('says so when no key is entered, without calling anyone', async () => {
    const fetch = mockFetch(200, {})
    expect(await testConnection({ ...zhipu, apiKey: '  ' })).toEqual({
      ok: false,
      error: 'No key entered yet.'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps quota and network failures to plain advice', () => {
    expect(describeAiFailure(new Error('AI provider error 429: quota'))).toMatch(/quota/)
    expect(describeAiFailure(new TypeError('fetch failed'))).toMatch(/internet connection/)
  })
})
