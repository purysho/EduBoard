import { describe, expect, it } from 'vitest'
import {
  appendSentence,
  DEFAULT_COMMENT_BANK,
  fillComment,
  parsePhraseSuggestions
} from '../commentBank'

describe('comment bank', () => {
  const ctx = { name: 'Mai', className: 'Grade 4 English', grade: '良好', percent: 81.6 }

  it('fills the placeholders', () => {
    expect(fillComment('{name} did well in {class}: {grade} ({percent}).', ctx)).toBe(
      'Mai did well in Grade 4 English: 良好 (82%).'
    )
  })

  it('leaves a placeholder showing when there is nothing to fill it with', () => {
    expect(fillComment('{name}: {grade} ({percent})', { ...ctx, grade: null, percent: null })).toBe(
      'Mai: {grade} ({percent})'
    )
  })

  it('adds sentences with one space between', () => {
    expect(appendSentence('', ' First. ')).toBe('First.')
    expect(appendSentence('First.  ', 'Second.')).toBe('First. Second.')
  })

  it('every default comment uses only known placeholders', () => {
    for (const c of DEFAULT_COMMENT_BANK) {
      expect(
        c.text.match(/\{(\w+)\}/g)?.every((p) => /\{(name|class|grade|percent)\}/.test(p)) ?? true
      ).toBe(true)
    }
  })
})

describe('AI phrase suggestions', () => {
  it('keeps short phrases that say what they rest on', () => {
    const reply =
      '```json\n[{"phrase":"shows steady improvement in recent tests","basis":"trend"},' +
      '{"phrase":"is always in class and on time","basis":"attendance"}]\n```'
    expect(parsePhraseSuggestions(reply)).toEqual([
      { phrase: 'shows steady improvement in recent tests', basis: 'trend' },
      { phrase: 'is always in class and on time', basis: 'attendance' }
    ])
  })

  it('drops full paragraphs, unknown bases and anything past five', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ')
    const reply = JSON.stringify([
      { phrase: long, basis: 'grade' },
      { phrase: 'loves football', basis: 'imagination' },
      ...Array.from({ length: 7 }, (_, i) => ({ phrase: `phrase ${i}`, basis: 'grade' }))
    ])
    const got = parsePhraseSuggestions(reply)
    expect(got).toHaveLength(5)
    expect(got.every((p) => p.phrase.startsWith('phrase'))).toBe(true)
  })

  it('refuses a reply that isn’t the expected list', () => {
    expect(() => parsePhraseSuggestions('Mai is a wonderful student who…')).toThrow(
      /couldn’t be read/
    )
    expect(() => parsePhraseSuggestions('{"phrase":"x"}')).toThrow(/couldn’t be read/)
    expect(() => parsePhraseSuggestions('[{"phrase":"x","basis":"vibes"}]')).toThrow(/usable/)
  })
})
