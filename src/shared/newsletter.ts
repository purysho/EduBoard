// Newsletters: the teacher picks who it's for and a structure, ticks which of this
// week's facts to include and adds their own notes. EduBoard puts those into the
// structure, by itself (no internet needed) or with AI suggesting the wording. The AI
// may only arrange and word the facts it's given; the teacher reads and edits the
// result before it goes anywhere.
//
// Text format, shared with the Portal's digest: "# Heading" lines, "- " bullet lines
// and plain paragraphs, separated by blank lines.
import { AppError } from './errorCodes'
import { tr } from './i18n'

export type NewsletterStructure = 'friendly' | 'minto' | 'simple' | 'custom'

export interface NewsletterFact {
  kind: 'lesson' | 'homework' | 'upcoming' | 'post' | 'number' | 'note'
  text: string
}

export interface StructureInfo {
  id: NewsletterStructure
  name: string
  forWhom: string
  sections: string[]
  /** What the AI is told this structure is. */
  howTo: string
}

export function newsletterStructures(): StructureInfo[] {
  return [
    {
      id: 'friendly',
      name: tr('Friendly (families)'),
      forWhom: tr('Warm and practical, for parents and guardians.'),
      sections: [
        tr('What we learned'),
        tr('Coming up'),
        tr('Highlights'),
        tr('How you can help at home')
      ],
      howTo:
        'A warm, practical update for parents: a one-line greeting, then the sections, then a short sign-off.'
    },
    {
      id: 'minto',
      name: tr('Pyramid (school leaders)'),
      forWhom: tr('Main message first, then the points that support it (the Minto pyramid).'),
      sections: [tr('Summary'), tr('Key points'), tr('Details'), tr('Next steps')],
      howTo:
        'The Minto pyramid: the single main message first, in one or two sentences; then two to four key points that support it, each backed by the facts; then details; then any action needed. Plain, factual, no greeting.'
    },
    {
      id: 'simple',
      name: tr('Simple (young readers)'),
      forWhom: tr('Short sentences and easy words, for students to read.'),
      sections: [tr('This week'), tr('Next week'), tr('Remember')],
      howTo:
        'For young students to read themselves: very short sentences, everyday words, at most three bullets per section.'
    },
    {
      id: 'custom',
      name: tr('My own sections'),
      forWhom: tr('Your own headings, one per line.'),
      sections: [],
      howTo: 'Use exactly the section headings given, in that order.'
    }
  ]
}

/** Which section each kind of fact goes under when EduBoard arranges it itself. */
function sectionFor(structure: NewsletterStructure, kind: NewsletterFact['kind']): number {
  const map: Record<
    Exclude<NewsletterStructure, 'custom'>,
    Record<NewsletterFact['kind'], number>
  > = {
    friendly: { lesson: 0, homework: 1, upcoming: 1, post: 2, number: 2, note: 3 },
    minto: { note: 0, number: 1, lesson: 2, post: 2, homework: 3, upcoming: 3 },
    simple: { lesson: 0, post: 0, number: 0, upcoming: 1, homework: 2, note: 2 }
  }
  return structure === 'custom' ? 0 : map[structure][kind]
}

/** Puts the facts under the structure's headings without AI: every fact appears once,
 * word for word. Empty sections are left out. */
export function assembleNewsletter(
  structure: NewsletterStructure,
  facts: NewsletterFact[],
  customSections: string[] = []
): string {
  const info = newsletterStructures().find((s) => s.id === structure)!
  const sections = structure === 'custom' ? customSections.filter((s) => s.trim()) : info.sections
  if (!sections.length) return facts.map((f) => `- ${f.text}`).join('\n')
  const buckets = sections.map(() => [] as string[])
  for (const f of facts)
    buckets[Math.min(sectionFor(structure, f.kind), sections.length - 1)].push(f.text)
  return sections
    .map((title, i) =>
      buckets[i].length ? `# ${title}\n${buckets[i].map((t) => `- ${t}`).join('\n')}` : ''
    )
    .filter(Boolean)
    .join('\n\n')
}

/** Checks an AI draft before showing it: plain text in the newsletter format, a sane
 * length, no HTML or code fences. Anything else is refused rather than shown. */
export function cleanNewsletterDraft(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{2,}\s/gm, '# ')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .trim()
  if (!cleaned)
    throw new AppError('EB-4003', tr('The AI didn’t suggest anything usable. Try again.'))
  if (cleaned.length > 8000)
    throw new AppError('EB-4003', tr('The AI’s draft was too long. Try again with fewer facts.'))
  return cleaned
}
