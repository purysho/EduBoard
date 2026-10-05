// A class's teaching profile: how this teacher teaches this class, in their own words.
// Every AI draft for the class (lesson plans, unit plans) is written to fit it, so a draft
// arrives in the shape the teacher actually teaches instead of a generic lesson.
//
// It is plain text the teacher writes, field by field, rather than menus: "first-year
// university, A1–B1, many near zero" says more than any dropdown could. It describes the
// class, never a student, so nothing in it is personal data.

export interface ClassAiProfile {
  /** Students' level and background, e.g. "First-year university, A1–B1, many near zero". */
  level: string
  /** Lesson length and structure, e.g. "45 min + 10 min break + 45 min". */
  lessonShape: string
  /** When the students' first language is used, e.g. "Chinese for planning only". */
  languageUse: string
  /** Routines every lesson should include, e.g. "speaking ladder, exit ticket". */
  routines: string
  /** What drafts should avoid, e.g. "open questions to the whole class". */
  avoid: string
  /** Anything else the drafts should respect. */
  notes: string
}

export const CLASS_AI_PROFILE_FIELDS = [
  'level',
  'lessonShape',
  'languageUse',
  'routines',
  'avoid',
  'notes'
] as const satisfies readonly (keyof ClassAiProfile)[]

export const CLASS_AI_PROFILE_MAX_CHARS = 500

export const EMPTY_CLASS_AI_PROFILE: ClassAiProfile = {
  level: '',
  lessonShape: '',
  languageUse: '',
  routines: '',
  avoid: '',
  notes: ''
}

/** A profile from anywhere (the renderer, a stored row): every field a trimmed string,
 * control characters removed, at most CLASS_AI_PROFILE_MAX_CHARS long. */
export function cleanClassAiProfile(value: unknown): ClassAiProfile {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const out = { ...EMPTY_CLASS_AI_PROFILE }
  for (const key of CLASS_AI_PROFILE_FIELDS) {
    const text = typeof raw[key] === 'string' ? (raw[key] as string) : ''
    out[key] = text
      .replace(/[^\P{Cc}\n\t]/gu, '')
      .trim()
      .slice(0, CLASS_AI_PROFILE_MAX_CHARS)
  }
  return out
}

export function isEmptyClassAiProfile(profile: ClassAiProfile): boolean {
  return CLASS_AI_PROFILE_FIELDS.every((key) => !profile[key])
}

const PROMPT_LABELS: Record<keyof ClassAiProfile, string> = {
  level: "Students' level and background",
  lessonShape: 'Lesson length and structure',
  languageUse: "Use of the students' first language",
  routines: 'Routines to include in every lesson',
  avoid: 'Avoid',
  notes: 'Other notes from the teacher'
}

/** The profile as lines for an AI prompt, or '' when the teacher hasn't filled it in. */
export function classAiProfilePrompt(profile: ClassAiProfile): string {
  const lines = CLASS_AI_PROFILE_FIELDS.filter((key) => profile[key]).map(
    (key) => `- ${PROMPT_LABELS[key]}: ${profile[key]}`
  )
  if (!lines.length) return ''
  return (
    "The teacher's profile of this class. Fit the draft to it: follow the lesson " +
    'structure and routines, pitch the language to the level, and respect what to avoid.\n' +
    lines.join('\n')
  )
}
