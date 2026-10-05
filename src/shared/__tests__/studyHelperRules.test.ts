import { describe, expect, it } from 'vitest'
import { cleanStudyHelperRules, isEmptyStudyHelperRules } from '../studyHelperRules'

describe('Study Helper rules', () => {
  it('keep only known languages and trimmed, capped text', () => {
    expect(
      cleanStudyHelperRules({
        replyLanguage: 'french',
        vocabulary: '  A2\u0000 ',
        rules: 'x'.repeat(600),
        extra: 'dropped'
      })
    ).toEqual({ replyLanguage: '', vocabulary: 'A2', rules: 'x'.repeat(500) })
    expect(cleanStudyHelperRules({ replyLanguage: 'english-gloss' }).replyLanguage).toBe(
      'english-gloss'
    )
    expect(isEmptyStudyHelperRules(cleanStudyHelperRules(null))).toBe(true)
    expect(isEmptyStudyHelperRules(cleanStudyHelperRules({ replyLanguage: 'own' }))).toBe(false)
  })
})
