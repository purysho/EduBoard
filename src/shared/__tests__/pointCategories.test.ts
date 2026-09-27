import { describe, expect, it } from 'vitest'
import {
  applyPointCategorySet,
  editablePointCategories,
  pointCategoryProblem,
  pointCategorySets,
  resolvePointCategories,
  summarisePoints
} from '../pointCategories'
import { makeSchoolPack, parseSchoolPack, planSchoolPack } from '../schoolPack'
import { DEFAULT_APP_SETTINGS } from '../types'

describe('point categories', () => {
  it('starts with EduBoard’s five and fills in blank built-in names', () => {
    expect(resolvePointCategories([]).map((c) => c.name)).toEqual([
      'Helping others',
      'On task',
      'Great answer',
      'Kindness',
      'Teamwork'
    ])
    expect(resolvePointCategories([{ id: 'kindness', name: '' }])[0].name).toBe('Kindness')
  })

  it('switches to a ready-made set, hiding (not dropping) the old ones', () => {
    const wuyu = pointCategorySets().find((s) => s.id === 'wuyu')!
    const next = applyPointCategorySet(editablePointCategories([]), wuyu)
    expect(next.filter((c) => !c.hidden).map((c) => c.id)).toEqual([
      'wuyu-de',
      'wuyu-zhi',
      'wuyu-ti',
      'wuyu-mei',
      'wuyu-lao'
    ])
    expect(next.filter((c) => c.hidden)).toHaveLength(5)
    expect(pointCategoryProblem(next)).toBeNull()
  })

  it('refuses unnamed or clashing categories', () => {
    expect(pointCategoryProblem([{ id: 'c:x', name: ' ' }])).toMatch(/needs a name/)
    expect(
      pointCategoryProblem([
        { id: 'c:x', name: 'Effort' },
        { id: 'c:y', name: 'effort' }
      ])
    ).toMatch(/same name/)
  })

  it('summarises in category order, with unknown ones as Other and zeros left out', () => {
    const cats = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' }
    ]
    const out = summarisePoints(
      [
        { category: 'b', points: 2 },
        { category: 'a', points: 1 },
        { category: 'c', points: 1 },
        { category: 'c', points: -1 },
        { category: 'gone', points: 1 },
        { category: null, points: 1 }
      ],
      cats
    )
    expect(out.map((x) => [x.name, x.total])).toEqual([
      ['A', 1],
      ['B', 2],
      ['Other', 2]
    ])
  })

  it('travel in a school pack, keeping categories this computer already has', () => {
    const from = {
      ...DEFAULT_APP_SETTINGS,
      pointCategories: [{ id: 'wuyu-de', name: 'Character' }]
    }
    const pack = parseSchoolPack(JSON.stringify(makeSchoolPack(from, [])))
    const here = { ...DEFAULT_APP_SETTINGS, pointCategories: [{ id: 'c:mine', name: 'Mine' }] }
    const plan = planSchoolPack(pack, here, [])
    expect(plan.settings.pointCategories?.map((c) => c.id)).toEqual(['c:mine', 'wuyu-de'])
    expect(plan.changes.join()).toMatch(/Character/)
  })
})
