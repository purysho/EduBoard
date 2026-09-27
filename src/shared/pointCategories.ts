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

export const BUILT_IN_POINT_CATEGORY_IDS = BUILT_INS.map((b) => b.id)

const builtInName = (id: string): string | null => {
  const b = BUILT_INS.find((x) => x.id === id)
  return b ? tr(b.en) : null
}

/** Every category in order, names filled in. With nothing saved, EduBoard's five. */
export function resolvePointCategories(saved: PointCategory[] | undefined): PointCategory[] {
  if (!saved?.length) return BUILT_INS.map((b) => ({ id: b.id, name: tr(b.en) }))
  return saved.map((c) => ({
    ...c,
    name: c.name.trim() || builtInName(c.id) || c.id
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

/** Ready-made sets. Names are written in the interface language when chosen, and can be
 * edited afterwards like any other. */
export function pointCategorySets(): PointCategorySet[] {
  const zh = uiLanguage() === 'zh'
  return [
    {
      id: 'wuyu',
      name: zh ? '德智体美劳（五育）' : '德智体美劳 (the five areas)',
      categories: zh
        ? [
            { id: 'wuyu-de', name: '德（品德）' },
            { id: 'wuyu-zhi', name: '智（学习）' },
            { id: 'wuyu-ti', name: '体（体育健康）' },
            { id: 'wuyu-mei', name: '美（艺术审美）' },
            { id: 'wuyu-lao', name: '劳（劳动实践）' }
          ]
        : [
            { id: 'wuyu-de', name: 'Character (德)' },
            { id: 'wuyu-zhi', name: 'Learning (智)' },
            { id: 'wuyu-ti', name: 'Health and PE (体)' },
            { id: 'wuyu-mei', name: 'Arts (美)' },
            { id: 'wuyu-lao', name: 'Work and service (劳)' }
          ]
    },
    {
      id: 'values',
      name: zh ? '品格（尊重、努力、合作…）' : 'Values (Respect, Effort, Teamwork…)',
      categories: zh
        ? [
            { id: 'values-respect', name: '尊重' },
            { id: 'values-effort', name: '努力' },
            { id: 'values-teamwork', name: '合作' },
            { id: 'values-kindness', name: '友善' },
            { id: 'values-responsibility', name: '责任' }
          ]
        : [
            { id: 'values-respect', name: 'Respect' },
            { id: 'values-effort', name: 'Effort' },
            { id: 'values-teamwork', name: 'Teamwork' },
            { id: 'values-kindness', name: 'Kindness' },
            { id: 'values-responsibility', name: 'Responsibility' }
          ]
    },
    {
      id: 'eduboard',
      name: tr('EduBoard’s five'),
      categories: BUILT_INS.map((b) => ({ id: b.id, name: '' }))
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
  const builtIn = new Set(BUILT_IN_POINT_CATEGORY_IDS)
  if (list.some((c) => !builtIn.has(c.id) && !c.name.trim())) {
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
