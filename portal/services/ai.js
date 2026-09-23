// Mirrors src/main/services/aiService.ts's OpenAI-compatible request shape, kept as a
// separate plain-JS copy since the Portal is a standalone Node service with no build
// step and doesn't share code with the Electron app's TypeScript.
const db = require('../db')

const PRESETS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' }
}

class AiNotConfiguredError extends Error {
  constructor() {
    super('The teacher hasn’t set up AI for students yet — ask them to add a key in Settings.')
    this.name = 'AiNotConfiguredError'
  }
}

function getAiSettings() {
  return db.prepare('SELECT * FROM ai_settings WHERE id = 1').get()
}

function saveAiSettings({ provider, apiKey, customBaseUrl, customModel }) {
  db.prepare(
    `INSERT INTO ai_settings (id, provider, api_key, custom_base_url, custom_model)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       provider = excluded.provider,
       api_key = excluded.api_key,
       custom_base_url = excluded.custom_base_url,
       custom_model = excluded.custom_model`
  ).run(provider || 'zhipu', apiKey || '', customBaseUrl || '', customModel || '')
}

async function completeAnthropic(apiKey, system, user, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
  })
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const block = (data.content || []).find((b) => b.type === 'text')
  return block ? block.text : ''
}

async function completeOpenAiCompatible(baseUrl, model, apiKey, system, user, maxTokens) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function complete(system, user, maxTokens) {
  const settings = getAiSettings()
  if (!settings || !settings.api_key) throw new AiNotConfiguredError()

  if (settings.provider === 'anthropic') {
    return completeAnthropic(settings.api_key, system, user, maxTokens)
  }
  if (settings.provider === 'custom') {
    if (!settings.custom_base_url || !settings.custom_model) throw new AiNotConfiguredError()
    return completeOpenAiCompatible(
      settings.custom_base_url,
      settings.custom_model,
      settings.api_key,
      system,
      user,
      maxTokens
    )
  }
  const preset = PRESETS[settings.provider] || PRESETS.zhipu
  return completeOpenAiCompatible(preset.baseUrl, preset.model, settings.api_key, system, user, maxTokens)
}

module.exports = { getAiSettings, saveAiSettings, complete, AiNotConfiguredError }
