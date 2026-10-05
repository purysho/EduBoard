import { describe, expect, it } from 'vitest'
import { cleanClassAiProfile, EMPTY_CLASS_AI_PROFILE } from '@shared/classAiProfile'
import { buildLessonPlanPrompt } from '../lessonDraftPrompt'

const input = {
  className: 'English 1',
  subject: 'English',
  gradeLevel: null,
  topic: 'Numbers in the news'
}

describe('lesson plan prompt', () => {
  it('sends the class, topic and language instruction without a profile section when none is set', () => {
    const { system, user } = buildLessonPlanPrompt(
      input,
      { profile: EMPTY_CLASS_AI_PROFILE },
      'Write the text in English.'
    )
    expect(system).toContain('Write the text in English.')
    expect(user).toContain('Class: English 1 (English)')
    expect(user).toContain('Topic for this lesson: Numbers in the news')
    expect(user).not.toContain("teacher's profile")
  })

  it("includes the class's teaching profile when the teacher has written one", () => {
    const { user } = buildLessonPlanPrompt(
      input,
      {
        profile: cleanClassAiProfile({
          level: 'A1–B1 first-years, several near zero',
          languageUse: 'Chinese for planning only'
        })
      },
      ''
    )
    expect(user).toContain("The teacher's profile of this class")
    expect(user).toContain("- Students' level and background: A1–B1 first-years, several near zero")
    expect(user).toContain("- Use of the students' first language: Chinese for planning only")
  })
})
