import type { DraftLessonPlanInput } from '@shared/types'
import { classAiProfilePrompt, type ClassAiProfile } from '@shared/classAiProfile'

// What the AI is told when it drafts a lesson plan for a class. Kept apart from the
// network call so the exact prompt can be tested.
//
// Everything here is the teacher's own words (class name, topic, the class profile) or
// counts and topic names from the class's own records: no student is named.

export interface LessonDraftContext {
  /** The class's teaching profile; may be all empty. */
  profile: ClassAiProfile
}

export function buildLessonPlanPrompt(
  input: DraftLessonPlanInput,
  context: LessonDraftContext,
  languageInstruction: string
): { system: string; user: string } {
  const system =
    'You draft lesson plans for teachers. Respond with ONLY a JSON object — no prose, ' +
    'no markdown fence — matching exactly this shape: ' +
    '{"title": string, "objectives": string, "materials": string, "activities": string, "homework": string}. ' +
    'Each field is plain text a teacher can edit directly (use "- " line prefixes for lists, not markdown). ' +
    'In "activities", give each step its minutes, e.g. "- Warm-up (5): ...". ' +
    languageInstruction

  const parts = [
    `Class: ${input.className}` +
      (input.subject ? ` (${input.subject})` : '') +
      (input.gradeLevel ? `, grade ${input.gradeLevel}` : ''),
    `Topic for this lesson: ${input.topic}`
  ]
  const profile = classAiProfilePrompt(context.profile)
  if (profile) parts.push(profile)
  return { system, user: parts.join('\n\n') }
}
