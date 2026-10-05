import type { DraftLessonPlanInput } from '@shared/types'
import { classAiProfilePrompt, type ClassAiProfile } from '@shared/classAiProfile'
import type { ClassEvidence } from './classEvidence'
import type { DraftUnitPlanInput } from '@shared/unitPlan'

const UNIT_CONTEXT_MAX = 2000

// What the AI is told when it drafts a lesson plan for a class. Kept apart from the
// network call so the exact prompt can be tested.
//
// Everything here is the teacher's own words (class name, topic, the class profile) or
// counts and topic names from the class's own records: no student is named.

export interface LessonDraftContext {
  /** The class's teaching profile; may be all empty. */
  profile: ClassAiProfile
  /** How the class has been doing lately; absent when not looked up. */
  evidence?: ClassEvidence
}

/** The class's recent record as prompt text, or '' when there is none. */
export function classEvidencePrompt(evidence: ClassEvidence): string {
  const parts: string[] = []
  if (evidence.recentLessons.length) {
    parts.push(
      'Recent lessons (build on the last one; do not repeat it):\n' +
        evidence.recentLessons
          .map((l) => `- ${l.date}: ${l.title}${l.objectives ? ` (aims: ${l.objectives})` : ''}`)
          .join('\n')
    )
  }
  if (evidence.ladder.length) {
    parts.push(
      'Speaking ladder marks (steps: 1 write, 2 read to a partner, 3 change one thing, 4 from ' +
        'keywords, 5 freely). Pitch speaking tasks so most students can reach the next step:\n' +
        evidence.ladder
          .map(
            (l) =>
              `- ${l.date} ${l.title}: ${l.marked} marked` +
              (l.median !== null
                ? `, median step ${l.median}, ${l.atLeast3} reached step 3+`
                : '') +
              (l.complete ? `, ${l.complete} complete` : '') +
              (l.missing ? `, ${l.missing} missing` : '')
          )
          .join('\n')
    )
  }
  if (evidence.assessments.length) {
    parts.push(
      'Recent assessments, class average (revisit anything weak):\n' +
        evidence.assessments
          .map((a) => `- ${a.name}: ${a.average}% (${a.scored} scored)`)
          .join('\n')
    )
  }
  if (evidence.reteach.length) {
    parts.push(
      'Exit-ticket questions where too few showed understanding (re-teach briefly):\n' +
        evidence.reteach.map((q) => `- "${q.prompt}": ${q.understood}% understood`).join('\n')
    )
  }
  if (!parts.length) return ''
  return 'How this class has been doing (counts only, no student names):\n\n' + parts.join('\n\n')
}

export function buildLessonPlanPrompt(
  input: DraftLessonPlanInput,
  context: LessonDraftContext,
  languageInstruction: string
): { system: string; user: string } {
  const system =
    'You draft lesson plans for teachers. Respond with ONLY a JSON object — no prose, ' +
    'no markdown fence — matching exactly this shape: ' +
    '{"title": string, "objectives": string, "materials": string, "activities": string, ' +
    '"support": string, "stretch": string, "homework": string}. ' +
    'Each field is plain text a teacher can edit directly (use "- " line prefixes for lists, not markdown). ' +
    'In "activities", give each step its minutes, e.g. "- Warm-up (5): ...". ' +
    'Everyone does the same main task: "support" is its floor (the same task made easier for ' +
    'students who need it: frames, model language, fewer items, more time) and "stretch" is ' +
    'its stretch (the same task made harder for those ready: less scaffolding, a twist, a ' +
    'harder audience). ' +
    languageInstruction

  const parts = [
    `Class: ${input.className}` +
      (input.subject ? ` (${input.subject})` : '') +
      (input.gradeLevel ? `, grade ${input.gradeLevel}` : ''),
    `Topic for this lesson: ${input.topic}`
  ]
  const unit = (input.unitContext ?? '').trim().slice(0, UNIT_CONTEXT_MAX)
  if (unit) parts.push(unit)
  const profile = classAiProfilePrompt(context.profile)
  if (profile) parts.push(profile)
  const evidence = context.evidence ? classEvidencePrompt(context.evidence) : ''
  if (evidence) parts.push(evidence)
  return { system, user: parts.join('\n\n') }
}

/** The prompt for planning a unit: prerequisites first, then lessons that each build on
 * the last and end with a check. Same class profile and record as a single lesson. */
export function buildUnitPlanPrompt(
  input: DraftUnitPlanInput,
  context: LessonDraftContext,
  languageInstruction: string
): { system: string; user: string } {
  const system =
    'You plan teaching units for teachers. Respond with ONLY a JSON object, no prose, no ' +
    'markdown fence, matching exactly this shape: {"title": string, "prerequisites": ' +
    '[string], "lessons": [{"title": string, "objectives": string, "check": string}]}. ' +
    'First work out what students must already know or be able to do for this unit ' +
    '("prerequisites", at most 5, short). Then sequence exactly the number of lessons asked ' +
    'for: each builds on the one before, starts from what the class can already do, and ' +
    'ends in something students produce. "objectives" says what students will be able to ' +
    'do by the end (one or two lines). "check" is a quick end-of-lesson check that shows ' +
    'whether the aim was met (e.g. a 3-question exit ticket, a pair task the teacher ' +
    'listens to). Plain text only. ' +
    languageInstruction

  const parts = [
    `Class: ${input.className}` +
      (input.subject ? ` (${input.subject})` : '') +
      (input.gradeLevel ? `, grade ${input.gradeLevel}` : ''),
    `Unit topic: ${input.topic}`,
    `Number of lessons: ${input.lessonCount}`
  ]
  const profile = classAiProfilePrompt(context.profile)
  if (profile) parts.push(profile)
  const evidence = context.evidence ? classEvidencePrompt(context.evidence) : ''
  if (evidence) parts.push(evidence)
  return { system, user: parts.join('\n\n') }
}
