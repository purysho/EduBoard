// Mirrors src/main/services/aiService.ts's OpenAI-compatible request shape, kept as a
// separate plain-JS copy since the Portal is a standalone Node service with no build
// step and doesn't share code with the Electron app's TypeScript.
const db = require('../db')

const PRESETS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  // Must match aiService.ts. Bare "glm-4-flash" is no longer an accepted model name.
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash-250414' }
}

class AiNotConfiguredError extends Error {
  constructor() {
    super('The teacher hasn’t set up AI for students yet — ask them to add a key in Settings.')
    this.name = 'AiNotConfiguredError'
  }
}

function getAiSettings(teacherId) {
  return db.prepare('SELECT * FROM ai_settings WHERE teacher_id = ?').get(teacherId)
}

function saveAiSettings(teacherId, { provider, apiKey, customBaseUrl, customModel, helperModel }) {
  db.prepare(
    `INSERT INTO ai_settings (teacher_id, provider, api_key, custom_base_url, custom_model, helper_model)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(teacher_id) DO UPDATE SET
       provider = excluded.provider,
       api_key = excluded.api_key,
       custom_base_url = excluded.custom_base_url,
       custom_model = excluded.custom_model,
       helper_model = excluded.helper_model`
  ).run(
    teacherId,
    provider || 'zhipu',
    apiKey || '',
    customBaseUrl || '',
    customModel || '',
    typeof helperModel === 'string' ? helperModel.trim().slice(0, 100) : ''
  )
}

/** The conversation: one question, or earlier turns ({ role, content }) ending in one. */
const asMessages = (user) => (Array.isArray(user) ? user : [{ role: 'user', content: user }])

const ANTHROPIC_MODEL = 'claude-opus-5'

/** Where a teacher's requests go: provider kind, address, model and key. The Study
 * Helper uses the model the teacher chose for it, if any. */
function targetFor(teacherId) {
  const settings = getAiSettings(teacherId)
  if (!settings || (!settings.api_key && settings.provider !== 'custom')) {
    throw new AiNotConfiguredError()
  }
  const chosen = (settings.helper_model || '').trim()
  if (settings.provider === 'anthropic') {
    return { kind: 'anthropic', model: chosen || ANTHROPIC_MODEL, apiKey: settings.api_key }
  }
  if (settings.provider === 'custom') {
    if (!settings.custom_base_url || !settings.custom_model) throw new AiNotConfiguredError()
    return {
      kind: 'openai',
      baseUrl: settings.custom_base_url,
      model: settings.custom_model,
      apiKey: settings.api_key
    }
  }
  const preset = PRESETS[settings.provider] || PRESETS.zhipu
  return {
    kind: 'openai',
    baseUrl: preset.baseUrl,
    model: chosen || preset.model,
    apiKey: settings.api_key
  }
}

function request(target, system, user, maxTokens, stream) {
  if (target.kind === 'anthropic') {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': target.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: target.model,
        max_tokens: maxTokens,
        system,
        messages: asMessages(user),
        ...(stream ? { stream: true } : {})
      })
    })
  }
  return fetch(`${target.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: target.model,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...asMessages(user)],
      ...(stream ? { stream: true } : {})
    })
  })
}

async function complete(teacherId, system, user, maxTokens) {
  const target = targetFor(teacherId)
  const res = await request(target, system, user, maxTokens, false)
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (target.kind === 'anthropic') {
    const block = (data.content || []).find((b) => b.type === 'text')
    return block ? block.text : ''
  }
  return data.choices?.[0]?.message?.content ?? ''
}

/** The text in one server-sent event from either kind of provider, or ''. */
function deltaOf(kind, data) {
  if (kind === 'anthropic') {
    return data.type === 'content_block_delta' && data.delta?.type === 'text_delta'
      ? data.delta.text || ''
      : ''
  }
  return data.choices?.[0]?.delta?.content || ''
}

/**
 * Like complete, but hands each piece of the reply to `onDelta` as it arrives, so a
 * student sees the answer being written instead of waiting for all of it. Returns the
 * whole reply. A provider that doesn't stream still works: its one reply is one piece.
 */
async function completeStream(teacherId, system, user, maxTokens, onDelta) {
  const target = targetFor(teacherId)
  const res = await request(target, system, user, maxTokens, true)
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`)
  if (!(res.headers.get('content-type') || '').includes('text/event-stream')) {
    const data = await res.json()
    const text =
      target.kind === 'anthropic'
        ? (data.content || []).find((b) => b.type === 'text')?.text || ''
        : data.choices?.[0]?.message?.content || ''
    if (text) onDelta(text)
    return text
  }
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const payload = line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!payload || payload === '[DONE]') continue
      let data
      try {
        data = JSON.parse(payload)
      } catch {
        continue
      }
      const piece = deltaOf(target.kind, data)
      if (piece) {
        full += piece
        onDelta(piece)
      }
    }
  }
  return full
}

module.exports = {
  getAiSettings,
  saveAiSettings,
  targetFor,
  complete,
  completeStream,
  AiNotConfiguredError
}
