// Class point categories: what a point is for. EduBoard starts with five (the reasons
// the Classroom tab always offered); a school can rename them, add its own, or switch to
// a ready-made set such as 德智体美劳. Each point stores its category's id, so renaming
// a category renames it everywhere. Categories are hidden, never deleted, so points
// already given keep their meaning.
import { tr, uiLanguage } from './i18n'

export interface PointCategory {
  /** Stored on each point: a built-in id, a ready-made set's id, or "c:" + a random id. */
  id: string
  /** Blank on a built-in means its usual name in the interface language. */
  name: string
  /** No longer offered for new points; points already given still count. */
  hidden?: boolean
}

/** The five EduBoard starts with, by id, with their English names (translated via tr). */
const BUILT_INS: { id: string; en: string }[] = [
  { id: 'helping', en: 'Helping others' },
  { id: 'on-task', en: 'On task' },
  { id: 'great-answer', en: 'Great answer' },
  { id: 'kindness', en: 'Kindness' },
  { id: 'teamwork', en: 'Teamwork' }
]

// The ready-made sets' categories, in both languages. Like the built-in five, they're
// saved with a blank name, which shows the usual name in the interface language.
const SET_NAMES: Record<string, { en: string; zh: string }> = {
  'wuyu-de': { en: 'Character (德)', zh: '德（品德）' },
  'wuyu-zhi': { en: 'Learning (智)', zh: '智（学习）' },
  'wuyu-ti': { en: 'Health and PE (体)', zh: '体（体育健康）' },
  'wuyu-mei': { en: 'Arts (美)', zh: '美（艺术审美）' },
  'wuyu-lao': { en: 'Work and service (劳)', zh: '劳（劳动实践）' },
  'values-respect': { en: 'Respect', zh: '尊重' },
  'values-effort': { en: 'Effort', zh: '努力' },
  'values-teamwork': { en: 'Teamwork', zh: '合作' },
  'values-kindness': { en: 'Kindness', zh: '友善' },
  'values-responsibility': { en: 'Responsibility', zh: '责任' }
}

/** A built-in or ready-made category's usual name in the interface language, or null
 * for the school's own. */
export function usualPointCategoryName(id: string): string | null {
  const b = BUILT_INS.find((x) => x.id === id)
  if (b) return tr(b.en)
  const set = SET_NAMES[id]
  return set ? set[uiLanguage() === 'zh' ? 'zh' : 'en'] : null
}

/** Every category in order, names filled in. With nothing saved, EduBoard's five. */
export function resolvePointCategories(saved: PointCategory[] | undefined): PointCategory[] {
  if (!saved?.length) return BUILT_INS.map((b) => ({ id: b.id, name: tr(b.en) }))
  return saved.map((c) => ({
    ...c,
    name: c.name.trim() || usualPointCategoryName(c.id) || c.id
  }))
}

/** What the teacher edits in Settings: the saved list, or EduBoard's five with blank
 * names (blank = the usual name, so it follows the interface language). */
export function editablePointCategories(saved: PointCategory[] | undefined): PointCategory[] {
  return saved?.length ? saved : BUILT_INS.map((b) => ({ id: b.id, name: '' }))
}

export interface PointCategorySet {
  id: string
  name: string
  categories: PointCategory[]
}

const blankNames = (ids: string[]): PointCategory[] => ids.map((id) => ({ id, name: '' }))

/** Ready-made sets, named in the interface language. */
export function pointCategorySets(): PointCategorySet[] {
  const zh = uiLanguage() === 'zh'
  return [
    {
      id: 'wuyu',
      name: zh ? '德智体美劳（五育）' : '德智体美劳 (the five areas)',
      categories: blankNames(['wuyu-de', 'wuyu-zhi', 'wuyu-ti', 'wuyu-mei', 'wuyu-lao'])
    },
    {
      id: 'values',
      name: zh ? '品格（尊重、努力、合作…）' : 'Values (Respect, Effort, Teamwork…)',
      categories: blankNames([
        'values-respect',
        'values-effort',
        'values-teamwork',
        'values-kindness',
        'values-responsibility'
      ])
    },
    {
      id: 'eduboard',
      name: tr('EduBoard’s five'),
      categories: blankNames(BUILT_INS.map((b) => b.id))
    }
  ]
}

/** Switches to a set: its categories come first and in use; every other category is
 * kept but hidden, so points already given keep their names. */
export function applyPointCategorySet(
  current: PointCategory[],
  set: PointCategorySet
): PointCategory[] {
  const ids = new Set(set.categories.map((c) => c.id))
  return [
    ...set.categories.map((c) => {
      const had = current.find((x) => x.id === c.id)
      return { ...c, name: had?.name.trim() ? had.name : c.name }
    }),
    ...current.filter((c) => !ids.has(c.id)).map((c) => ({ ...c, hidden: true }))
  ]
}

/** Problems with categories being edited, in plain words, or null if they're fine. */
export function pointCategoryProblem(list: PointCategory[]): string | null {
  if (list.some((c) => !usualPointCategoryName(c.id) && !c.name.trim())) {
    return tr('Every point category needs a name.')
  }
  if (list.some((c) => c.name.trim().length > 40)) {
    return tr('A point category’s name can be at most 40 characters.')
  }
  const names = resolvePointCategories(list).map((c) => c.name.toLowerCase())
  if (new Set(names).size !== names.length) return tr('Two point categories have the same name.')
  return null
}

export const newPointCategoryId = (): string => `c:${Math.random().toString(36).slice(2, 10)}`

export interface PointSummaryItem {
  /** Null for points given with no category (or one no longer known). */
  categoryId: string | null
  name: string
  total: number
}

/** Totals per category, in the categories' order, then anything uncategorised as
 * "Other". Categories with a zero total are left out. */
export function summarisePoints(
  points: { category: string | null; points: number }[],
  categories: PointCategory[]
): PointSummaryItem[] {
  const totals = new Map<string | null, number>()
  const known = new Set(categories.map((c) => c.id))
  for (const p of points) {
    const key = p.category && known.has(p.category) ? p.category : null
    totals.set(key, (totals.get(key) ?? 0) + p.points)
  }
  const out: PointSummaryItem[] = categories
    .map((c) => ({ categoryId: c.id, name: c.name, total: totals.get(c.id) ?? 0 }))
    .filter((x) => x.total !== 0)
  const other = totals.get(null) ?? 0
  if (other !== 0) out.push({ categoryId: null, name: tr('Other'), total: other })
  return out
}

/** "Character 12 · Learning 8" */
export function formatPointSummary(items: PointSummaryItem[]): string {
  return items.map((i) => `${i.name} ${i.total}`).join(' · ')
}
