import Anthropic from '@anthropic-ai/sdk'
import { getSettings } from '../repositories/settingsRepo'
import type {
  DraftedLessonPlan,
  DraftLessonPlanInput,
  DraftReportCommentInput
} from '@shared/types'

const MODEL = 'claude-opus-5'

export class AiNotConfiguredError extends Error {
  constructor() {
    super('No Anthropic API key set — add one in Settings to use AI features.')
    this.name = 'AiNotConfiguredError'
  }
}

function getClient(): Anthropic {
  const apiKey = getSettings().aiApiKey.trim()
  if (!apiKey) throw new AiNotConfiguredError()
  return new Anthropic({ apiKey })
}

/** Pulls the first text block out of a response — every call here is a single plain-text
 * (or text-encoded-JSON) request, never tool use, so there's exactly one to find. */
function textFrom(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

/** Strips a ```json fenced code block if the model wrapped its JSON in one, despite
 * being asked not to — cheap insurance against an otherwise-valid response failing to
 * parse. */
function stripCodeFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return match ? match[1] : text
}

export async function draftLessonPlan(input: DraftLessonPlanInput): Promise<DraftedLessonPlan> {
  const client = getClient()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      'You draft lesson plans for teachers. Respond with ONLY a JSON object — no prose, ' +
      'no markdown fence — matching exactly this shape: ' +
      '{"title": string, "objectives": string, "materials": string, "activities": string, "homework": string}. ' +
      'Each field is plain text a teacher can edit directly (use "- " line prefixes for lists, not markdown).',
    messages: [
      {
        role: 'user',
        content:
          `Class: ${input.className}` +
          (input.subject ? ` (${input.subject})` : '') +
          (input.gradeLevel ? `, grade ${input.gradeLevel}` : '') +
          `\nTopic for this lesson: ${input.topic}`
      }
    ]
  })

  const parsed = JSON.parse(stripCodeFence(textFrom(response)))
  return {
    title: String(parsed.title ?? input.topic),
    objectives: String(parsed.objectives ?? ''),
    materials: String(parsed.materials ?? ''),
    activities: String(parsed.activities ?? ''),
    homework: String(parsed.homework ?? '')
  }
}

export async function draftReportComment(input: DraftReportCommentInput): Promise<string> {
  const client = getClient()
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You write brief, specific, encouraging-but-honest report card comments for teachers ' +
      'to send to parents/guardians. 2-4 sentences. Plain text only, no markdown, no greeting ' +
      'or sign-off (the teacher adds those). Base the comment only on the data given — never ' +
      'invent specifics not present in it.',
    messages: [
      {
        role: 'user',
        content: `Student: ${input.studentName}\nClass: ${input.className}\n${gradeLine}\n${attendanceLine}\n${notesLine}`
      }
    ]
  })

  return textFrom(response).trim()
}
