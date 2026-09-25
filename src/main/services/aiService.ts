import Anthropic from '@anthropic-ai/sdk'
import { getSettings } from '../repositories/settingsRepo'
import type {
  AiConnectionConfig,
  AiConnectionTestResult,
  AiProvider,
  DraftedLessonPlan,
  DraftLessonPlanInput,
  DraftReportCommentInput
} from '@shared/types'

const ANTHROPIC_MODEL = 'claude-opus-5'

// Every non-Anthropic preset speaks the same OpenAI-compatible chat/completions shape —
// only the base URL, model name, and (rarely) whether a key is required differ.
const OPENAI_COMPATIBLE_PRESETS: Record<
  Exclude<AiProvider, 'anthropic' | 'custom'>,
  { baseUrl: string; model: string }
> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  },
  // GLM-4-Flash-250414 is Zhipu's genuinely-free tier (not just cheap) — the default for the
  // Portal's student-facing AI key, where "free enough to hand to a whole class" matters
  // more than raw quality.
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash-250414' }
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('No AI API key set — add one in Settings to use AI features.')
    this.name = 'AiNotConfiguredError'
  }
}

/** Strips a ```json fenced code block if the model wrapped its JSON in one, despite
 * being asked not to — cheap insurance against an otherwise-valid response failing to
 * parse. */
function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return match ? match[1] : text
}

async function completeAnthropic(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }]
  })
  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

/** Any OpenAI-compatible chat/completions endpoint — every preset besides Anthropic,
 * plus a fully teacher-specified 'custom' provider (any base URL/model, e.g. a local
 * Ollama server, Moonshot, Zhipu, OpenAI itself — anything speaking this same shape).
 * A plain fetch call is enough here; no SDK needed for any of these. */
async function completeOpenAiCompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
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
  if (!res.ok) {
    throw new Error(`AI provider error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/** The model a config will actually call — shown in the test result so a teacher can
 * see which model their key reached. */
export function modelFor(config: AiConnectionConfig): string {
  if (config.provider === 'anthropic') return ANTHROPIC_MODEL
  if (config.provider === 'custom') return config.customModel.trim()
  return OPENAI_COMPATIBLE_PRESETS[config.provider].model
}

async function completeWith(
  config: AiConnectionConfig,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const provider = config.provider
  const apiKey = config.apiKey.trim()

  if (provider === 'custom') {
    const baseUrl = config.customBaseUrl.trim()
    const model = config.customModel.trim()
    if (!baseUrl || !model) throw new AiNotConfiguredError()
    // A key isn't required for every custom endpoint (e.g. a local Ollama server) —
    // only Anthropic and the built-in presets below need one to even attempt a call.
    return completeOpenAiCompatible(baseUrl, model, apiKey, system, user, maxTokens)
  }

  if (!apiKey) throw new AiNotConfiguredError()

  if (provider === 'anthropic') {
    return completeAnthropic(apiKey, system, user, maxTokens)
  }
  const preset = OPENAI_COMPATIBLE_PRESETS[provider]
  return completeOpenAiCompatible(preset.baseUrl, preset.model, apiKey, system, user, maxTokens)
}

async function complete(system: string, user: string, maxTokens: number): Promise<string> {
  const settings = getSettings()
  return completeWith(
    {
      provider: settings.aiProvider,
      apiKey: settings.aiApiKey,
      customBaseUrl: settings.aiCustomBaseUrl,
      customModel: settings.aiCustomModel
    },
    system,
    user,
    maxTokens
  )
}

/** Turns a provider failure into something a teacher can act on. The raw provider
 * text stays at the end, because it is often the most specific part (e.g. Zhipu's
 * "模型不存在" for a retired model name). */
export function describeAiFailure(err: unknown): string {
  if (err instanceof AiNotConfiguredError) return 'No key entered yet.'
  const message = err instanceof Error ? err.message : String(err)
  const status =
    /AI provider error (\d{3})/.exec(message)?.[1] ?? /\b(401|403|404|429)\b/.exec(message)?.[1]
  const detail = message.replace(/^AI provider error \d{3}: /, '').slice(0, 300)
  switch (status) {
    case '401':
    case '403':
      return `The provider rejected the key. Check it was copied in full. (${detail})`
    case '404':
      return `The provider doesn't recognise this model or address. (${detail})`
    case '429':
      return `The key works but is out of quota or rate-limited right now. (${detail})`
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(message)) {
    return `Couldn't reach the provider. Check this computer's internet connection or VPN. (${detail})`
  }
  return detail
}

/** Sends one tiny request with the given settings (which may not be saved yet), so a
 * teacher finds out a key or model name is wrong in Settings rather than in class. */
export async function testConnection(config: AiConnectionConfig): Promise<AiConnectionTestResult> {
  try {
    const reply = await completeWith(
      config,
      'You are a connection check. Reply with just the word OK.',
      'Reply with OK.',
      16
    )
    return { ok: true, model: modelFor(config), reply: reply.trim().slice(0, 100) }
  } catch (err) {
    return { ok: false, error: describeAiFailure(err) }
  }
}

/** A general-purpose escape hatch onto whichever provider/model is configured — used by
 * anything that isn't one of this file's own two fixed-shape drafting prompts (e.g. the
 * Notebook's question-answering, which needs to hand over a variable amount of
 * retrieved context rather than a fixed template). */
export async function askAi(system: string, user: string, maxTokens: number): Promise<string> {
  return complete(system, user, maxTokens)
}

export async function draftLessonPlan(input: DraftLessonPlanInput): Promise<DraftedLessonPlan> {
  const system =
    'You draft lesson plans for teachers. Respond with ONLY a JSON object — no prose, ' +
    'no markdown fence — matching exactly this shape: ' +
    '{"title": string, "objectives": string, "materials": string, "activities": string, "homework": string}. ' +
    'Each field is plain text a teacher can edit directly (use "- " line prefixes for lists, not markdown).'
  const user =
    `Class: ${input.className}` +
    (input.subject ? ` (${input.subject})` : '') +
    (input.gradeLevel ? `, grade ${input.gradeLevel}` : '') +
    `\nTopic for this lesson: ${input.topic}`

  const text = await complete(system, user, 2048)
  const parsed = JSON.parse(stripCodeFence(text))
  return {
    title: String(parsed.title ?? input.topic),
    objectives: String(parsed.objectives ?? ''),
    materials: String(parsed.materials ?? ''),
    activities: String(parsed.activities ?? ''),
    homework: String(parsed.homework ?? '')
  }
}

export async function draftReportComment(input: DraftReportCommentInput): Promise<string> {
  const gradeLine =
    input.percent !== null
      ? `Current grade: ${input.percent.toFixed(0)}% (${input.letter ?? 'no letter'})`
      : 'Current grade: not enough data yet'
  const attendanceLine =
    input.attendanceRate !== null
      ? `Attendance rate: ${(input.attendanceRate * 100).toFixed(0)}%`
      : 'Attendance rate: not enough data yet'
  const notesLine = input.recentNotes.length
    ? `Recent teacher notes on this student: ${input.recentNotes.join('; ')}`
    : 'No recent teacher notes on this student.'
  const trendLine =
    input.trendDirection && input.trendDeltaPoints !== null
      ? `Grade trend across recent assessments: ${input.trendDirection} (${input.trendDeltaPoints > 0 ? '+' : ''}${input.trendDeltaPoints.toFixed(0)} points from first to most recent scored assessment).`
      : 'Not enough scored assessments yet to show a grade trend.'

  const system =
    'You write brief, specific, encouraging-but-honest report card comments for teachers ' +
    'to send to parents/guardians. 2-4 sentences. Plain text only, no markdown, no greeting ' +
    'or sign-off (the teacher adds those). Base the comment only on the data given — never ' +
    'invent specifics not present in it. If the trend is declining, name it gently and ' +
    'constructively rather than alarmingly; if improving, acknowledge the improvement ' +
    'specifically rather than generically.'
  const user = `Student: ${input.studentName}\nClass: ${input.className}\n${gradeLine}\n${attendanceLine}\n${trendLine}\n${notesLine}`

  const text = await complete(system, user, 1024)
  return text.trim()
}
