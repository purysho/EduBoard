import { describe, expect, it } from 'vitest'
import { assembleNewsletter, cleanNewsletterDraft, type NewsletterFact } from '../newsletter'

const facts: NewsletterFact[] = [
  { kind: 'lesson', text: 'Animals: reading' },
  { kind: 'homework', text: 'Animal fact sheet (due 2026-10-02)' },
  { kind: 'note', text: 'Trip to the zoo on Friday' }
]

describe('newsletters', () => {
  it('arranges every fact, word for word, under the structure’s headings', () => {
    expect(assembleNewsletter('friendly', facts)).toBe(
      '# What we learned\n- Animals: reading\n\n# Coming up\n- Animal fact sheet (due 2026-10-02)\n\n# How you can help at home\n- Trip to the zoo on Friday'
    )
    const pyramid = assembleNewsletter('minto', facts)
    expect(pyramid.startsWith('# Summary\n- Trip to the zoo on Friday')).toBe(true)
    expect(assembleNewsletter('custom', facts, ['News', ''])).toBe(
      '# News\n- Animals: reading\n- Animal fact sheet (due 2026-10-02)\n- Trip to the zoo on Friday'
    )
  })

  it('cleans an AI draft into the newsletter format and refuses an empty one', () => {
    expect(
      cleanNewsletterDraft('```\n## This week\n* We read **books**\n<script>x</script>\n```')
    ).toBe('# This week\n- We read books\nx')
    expect(() => cleanNewsletterDraft('   ')).toThrow(/usable/)
    expect(() => cleanNewsletterDraft('x'.repeat(9000))).toThrow(/too long/)
  })
})
