import { describe, expect, it } from 'vitest'
import {
  CLASS_AI_PROFILE_MAX_CHARS,
  classAiProfilePrompt,
  cleanClassAiProfile,
  isEmptyClassAiProfile
} from '../classAiProfile'

describe('class teaching profile', () => {
  it('keeps only known text fields, trimmed, without control characters, capped', () => {
    const profile = cleanClassAiProfile({
      level: '  A1–B1 first-years \u0007',
      routines: 'x'.repeat(CLASS_AI_PROFILE_MAX_CHARS + 50),
      avoid: 42,
      extra: 'ignored'
    })
    expect(profile.level).toBe('A1–B1 first-years')
    expect(profile.routines).toHaveLength(CLASS_AI_PROFILE_MAX_CHARS)
    expect(profile.avoid).toBe('')
    expect(profile).not.toHaveProperty('extra')
    expect(isEmptyClassAiProfile(cleanClassAiProfile(null))).toBe(true)
  })

  it('becomes prompt lines only for the fields the teacher filled in', () => {
    expect(classAiProfilePrompt(cleanClassAiProfile({}))).toBe('')
    const prompt = classAiProfilePrompt(
      cleanClassAiProfile({ lessonShape: '45 + 10 + 45', avoid: 'open questions to the class' })
    )
    expect(prompt).toContain('- Lesson length and structure: 45 + 10 + 45')
    expect(prompt).toContain('- Avoid: open questions to the class')
    expect(prompt).not.toContain('first language')
  })
})
