// Report card comment bank: ready-made sentences with placeholders the teacher adds to
// a student's comment in one click, then edits. {name} is the name the student goes by.

export const COMMENT_CATEGORIES = [
  'Strength',
  'Next step',
  'Effort',
  'Behaviour',
  'General'
] as const
export type CommentCategory = (typeof COMMENT_CATEGORIES)[number]

export interface BankComment {
  category: CommentCategory
  text: string
}

export const DEFAULT_COMMENT_BANK: BankComment[] = [
  { category: 'Strength', text: '{name} has made excellent progress in {class} this term.' },
  {
    category: 'Strength',
    text: '{name} shows real confidence when speaking in front of the class.'
  },
  { category: 'Strength', text: '{name} consistently produces careful, thoughtful work.' },
  {
    category: 'Strength',
    text: '{name} asks thoughtful questions that help the whole class learn.'
  },
  {
    category: 'Next step',
    text: 'Next term, {name} should focus on checking work carefully before handing it in.'
  },
  {
    category: 'Next step',
    text: '{name} would benefit from reading aloud at home for ten minutes each day.'
  },
  {
    category: 'Next step',
    text: 'A next step for {name} is to use new vocabulary in longer sentences.'
  },
  {
    category: 'Next step',
    text: '{name} should keep practising the skills covered in class to build fluency.'
  },
  { category: 'Effort', text: '{name} always tries hard and never gives up on a difficult task.' },
  { category: 'Effort', text: '{name} completes homework on time and to a good standard.' },
  {
    category: 'Effort',
    text: 'With a little more effort in class, {name} could achieve even more.'
  },
  { category: 'Behaviour', text: '{name} is kind and helpful to classmates.' },
  { category: 'Behaviour', text: '{name} listens well and follows instructions.' },
  { category: 'Behaviour', text: '{name} works well in a group and shares ideas generously.' },
  {
    category: 'General',
    text: '{name} finished the term with an overall grade of {grade} ({percent}).'
  },
  { category: 'General', text: 'It has been a pleasure teaching {name} this term.' }
]

export interface CommentContext {
  name: string
  className: string
  grade: string | null
  percent: number | null
}

/** Fills {name}, {class}, {grade} and {percent}. A placeholder with nothing to fill it
 * (no grade yet) is left visible, so the teacher notices and edits it. */
export function fillComment(text: string, ctx: CommentContext): string {
  return text
    .replace(/\{name\}/g, ctx.name)
    .replace(/\{class\}/g, ctx.className)
    .replace(/\{grade\}/g, ctx.grade ?? '{grade}')
    .replace(/\{percent\}/g, ctx.percent === null ? '{percent}' : `${Math.round(ctx.percent)}%`)
}

/** Adds a sentence to a comment, with a space between. */
export function appendSentence(comment: string, sentence: string): string {
  const base = comment.trimEnd()
  return base ? `${base} ${sentence.trim()}` : sentence.trim()
}

/** An AI-suggested phrase and what in the student's data it rests on. */
export interface PhraseSuggestion {
  phrase: string
  basis: string
}

const BASES = ['grade', 'trend', 'attendance', 'notes']

/** Checks the AI's reply: a JSON array of short phrases, each saying which of the data
 * it's based on. Anything else is refused rather than shown, since the teacher is meant
 * to be able to see why each suggestion was made. */
export function parsePhraseSuggestions(text: string): PhraseSuggestion[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch {
    throw new Error('The AI’s suggestions couldn’t be read. Try again.')
  }
  if (!Array.isArray(raw)) throw new Error('The AI’s suggestions couldn’t be read. Try again.')
  const out: PhraseSuggestion[] = []
  for (const item of raw) {
    const phrase = typeof item?.phrase === 'string' ? item.phrase.trim() : ''
    const basis = typeof item?.basis === 'string' ? item.basis.trim().toLowerCase() : ''
    if (!phrase || phrase.length > 160 || phrase.split(/\s+/).length > 25) continue
    if (!BASES.includes(basis)) continue
    out.push({ phrase, basis })
    if (out.length === 5) break
  }
  if (!out.length) throw new Error('The AI didn’t suggest anything usable. Try again.')
  return out
}
