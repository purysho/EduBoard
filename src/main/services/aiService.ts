import Anthropic from '@anthropic-ai/sdk'
import { getSettings } from '../repositories/settingsRepo'
import type {
  AiProvider,
  DraftedLessonPlan,
  DraftLessonPlanInput,
  DraftReportCommentInput
} from '@shared/types'

const ANTHROPIC_MODEL = 'claude-opus-5'
const DEEPSEEK_MODEL = 'deepseek-chat'

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

/** DeepSeek's API is OpenAI-compatible chat completions — a plain fetch call is enough
 * here, so this doesn't need a whole second SDK dependency for one provider. */
async function completeDeepSeek(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })
  if (!res.ok) {
    throw new Error(`DeepSeek API error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function complete(system: string, user: string, maxTokens: number): Promise<string> {
  const settings = getSettings()
  const apiKey = settings.aiApiKey.trim()
  if (!apiKey) throw new AiNotConfiguredError()

  const provider: AiProvider = settings.aiProvider
  return provider === 'anthropic'
    ? completeAnthropic(apiKey, system, user, maxTokens)
    : completeDeepSeek(apiKey, system, user, maxTokens)
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

  const system =
    'You write brief, specific, encouraging-but-honest report card comments for teachers ' +
    'to send to parents/guardians. 2-4 sentences. Plain text only, no markdown, no greeting ' +
    'or sign-off (the teacher adds those). Base the comment only on the data given — never ' +
    'invent specifics not present in it.'
  const user = `Student: ${input.studentName}\nClass: ${input.className}\n${gradeLine}\n${attendanceLine}\n${notesLine}`

  const text = await complete(system, user, 1024)
  return text.trim()
}
