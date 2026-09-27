import { afterEach, describe, expect, it } from 'vitest'
import {
  commentSets,
  lessonTemplates,
  letterTemplates,
  resolveReportLayout,
  storyTemplates
} from '../templates'
import { makeSchoolPack, parseSchoolPack, planSchoolPack } from '../schoolPack'
import { DEFAULT_APP_SETTINGS } from '../types'
import { COMMENT_CATEGORIES } from '../commentBank'
import { setUiLanguage } from '../i18n'

const placeholders = (s: string): string[] => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort()

afterEach(() => setUiLanguage('en'))

describe('templates', () => {
  it('has every template in both languages, with the same letter placeholders', () => {
    const en = {
      letters: letterTemplates(),
      stories: storyTemplates(),
      lessons: lessonTemplates(),
      sets: commentSets()
    }
    setUiLanguage('zh')
    const zh = {
      letters: letterTemplates(),
      stories: storyTemplates(),
      lessons: lessonTemplates(),
      sets: commentSets()
    }
    expect(zh.letters.map((t) => t.id)).toEqual(en.letters.map((t) => t.id))
    en.letters.forEach((t, i) => {
      // A Chinese letter may add {date}; it never drops a detail the English fills in.
      for (const p of placeholders(t.body)) expect(zh.letters[i].body).toContain(p)
      expect(zh.letters[i].name).not.toBe(t.name)
    })
    expect(zh.stories.length).toBe(en.stories.length)
    expect(zh.lessons.map((t) => t.id)).toEqual(en.lessons.map((t) => t.id))
    for (const set of [...en.sets, ...zh.sets]) {
      for (const c of set.comments) expect(COMMENT_CATEGORIES).toContain(c.category)
    }
  })

  it('fills a report layout from its preset', () => {
    expect(resolveReportLayout(undefined)).toMatchObject({
      preset: 'standard',
      showAssessments: true,
      showSignatures: false
    })
    expect(resolveReportLayout({ preset: 'compact' })).toMatchObject({
      showAssessments: false,
      showComment: true
    })
    expect(resolveReportLayout({ preset: 'detailed', showCategories: false })).toMatchObject({
      showSignatures: true,
      showCategories: false
    })
  })

  it('shares layouts and saved templates in a school pack, adding templates only', () => {
    const from = {
      ...DEFAULT_APP_SETTINGS,
      reportCard: { preset: 'detailed' as const, title: 'End of term report' },
      savedTemplates: [
        { id: 't1', kind: 'letter' as const, name: 'Trip letter', body: 'Dear {guardian}' }
      ]
    }
    const pack = parseSchoolPack(JSON.stringify(makeSchoolPack(from, [])))
    const here = {
      ...DEFAULT_APP_SETTINGS,
      savedTemplates: [{ id: 'mine', kind: 'story' as const, name: 'Mine', body: 'x' }]
    }
    const plan = planSchoolPack(pack, here, [])
    expect(plan.settings.reportCard).toMatchObject({
      preset: 'detailed',
      title: 'End of term report',
      showSignatures: true
    })
    expect(plan.settings.savedTemplates?.map((t) => t.id)).toEqual(['mine', 't1'])
  })
})
