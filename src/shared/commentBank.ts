// Report card comment bank: ready-made sentences with placeholders the teacher adds to
// a student's comment in one click, then edits. {name} is the name the student goes by.
import { tr, uiLanguage } from './i18n'

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

/** The same bank, written for Chinese report cards. */
export const DEFAULT_COMMENT_BANK_ZH: BankComment[] = [
  { category: 'Strength', text: '本学期{name}在{class}中取得了很大的进步。' },
  { category: 'Strength', text: '{name}在全班面前发言时表现得很自信。' },
  { category: 'Strength', text: '{name}的作业一贯认真细致、用心思考。' },
  { category: 'Strength', text: '{name}善于提出有深度的问题，带动全班一起学习。' },
  { category: 'Next step', text: '下学期，{name}应注意在交作业前仔细检查。' },
  { category: 'Next step', text: '建议{name}每天在家朗读十分钟。' },
  { category: 'Next step', text: '{name}下一步可以尝试把新学的词汇用在更长的句子里。' },
  { category: 'Next step', text: '{name}应继续练习课堂上学过的技能，做到更加熟练。' },
  { category: 'Effort', text: '{name}学习努力，遇到难题从不放弃。' },
  { category: 'Effort', text: '{name}能按时完成作业，质量良好。' },
  { category: 'Effort', text: '如果课堂上再多一点努力，{name}一定能取得更好的成绩。' },
  { category: 'Behaviour', text: '{name}待人友善，乐于帮助同学。' },
  { category: 'Behaviour', text: '{name}认真听讲，能遵守课堂要求。' },
  { category: 'Behaviour', text: '{name}善于小组合作，乐于分享自己的想法。' },
  { category: 'General', text: '{name}本学期的总评成绩为{grade}（{percent}）。' },
  { category: 'General', text: '本学期能教{name}，我感到非常高兴。' }
]

/** The built-in bank in the interface language. */
export function defaultCommentBank(): BankComment[] {
  return uiLanguage() === 'zh' ? DEFAULT_COMMENT_BANK_ZH : DEFAULT_COMMENT_BANK
}

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
    throw new Error(tr('The AI’s suggestions couldn’t be read. Try again.'))
  }
  if (!Array.isArray(raw)) throw new Error(tr('The AI’s suggestions couldn’t be read. Try again.'))
  const out: PhraseSuggestion[] = []
  for (const item of raw) {
    const phrase = typeof item?.phrase === 'string' ? item.phrase.trim() : ''
    const basis = typeof item?.basis === 'string' ? item.basis.trim().toLowerCase() : ''
    if (!phrase || phrase.length > 160 || phrase.split(/\s+/).length > 25) continue
    if (!BASES.includes(basis)) continue
    out.push({ phrase, basis })
    if (out.length === 5) break
  }
  if (!out.length) throw new Error(tr('The AI didn’t suggest anything usable. Try again.'))
  return out
}
