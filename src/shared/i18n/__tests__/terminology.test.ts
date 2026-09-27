import { afterEach, describe, expect, it } from 'vitest'
import { setTerminology, setUiLanguage, tr, trn } from '..'
import { makeSchoolPack, parseSchoolPack, planSchoolPack } from '../../schoolPack'
import { DEFAULT_APP_SETTINGS } from '../../types'

afterEach(() => {
  setUiLanguage('en')
  setTerminology({})
})

describe('the school’s own words', () => {
  it('replaces a word in every form, keeping capitals, and never inside a placeholder', () => {
    setTerminology({ en: { class: { one: 'section', other: 'sections' } } })
    expect(tr('Class name')).toBe('Section name')
    expect(tr('Every class, section, and club you teach.')).toBe(
      'Every section, section, and club you teach.'
    )
    expect(trn('Create {n} class', 'Create {n} classes', 3)).toBe('Create 3 sections')
    expect(tr('Classroom')).toBe('Classroom')
    // {class} is filled in, not renamed, and the value itself is left alone.
    expect(tr('Hello {class}', { class: 'Class 4B' })).toBe('Hello Class 4B')
  })

  it('uses the Chinese words only when EduBoard is in Chinese', () => {
    setUiLanguage('zh')
    setTerminology({
      zh: { assessment: '考试' },
      en: { assessment: { one: 'test', other: 'tests' } }
    })
    expect(tr('New assessment')).toBe('新建考试')
    setUiLanguage('en')
    setTerminology({
      zh: { assessment: '考试' },
      en: { assessment: { one: 'test', other: 'tests' } }
    })
    expect(tr('New assessment')).toBe('New test')
  })

  it('travels in a school pack', () => {
    const terminology = { en: { student: { one: 'learner', other: 'learners' } } }
    const pack = parseSchoolPack(
      JSON.stringify(makeSchoolPack({ ...DEFAULT_APP_SETTINGS, terminology }, []))
    )
    const plan = planSchoolPack(pack, DEFAULT_APP_SETTINGS, [])
    expect(plan.settings.terminology).toEqual(terminology)
  })
})
