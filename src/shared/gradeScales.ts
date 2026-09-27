// Grading scales. A class's letter is worked out from its percent by bands: the first
// band (highest cut-off first) the percent reaches. EduBoard's own A–F uses the A/B/C/D
// cut-offs in GradeThresholds; any other scale lists its bands in `scale`.
import type { GradeThresholds } from './types'
import { tr } from './i18n'

export interface GradeBand {
  label: string
  /** Lowest percent that earns this band. The lowest band should be 0. */
  min: number
}

export interface GradeScalePreset {
  id: string
  name: string
  /** Null: EduBoard's A–F, cut-offs set by A/B/C/D. */
  bands: GradeBand[] | null
  note?: string
}

export const GRADE_SCALE_PRESETS: GradeScalePreset[] = [
  { id: 'af', name: 'A–F', bands: null },
  {
    id: 'af-plus-minus',
    name: tr('A–F with + and −'),
    bands: [
      { label: 'A+', min: 97 },
      { label: 'A', min: 93 },
      { label: 'A−', min: 90 },
      { label: 'B+', min: 87 },
      { label: 'B', min: 83 },
      { label: 'B−', min: 80 },
      { label: 'C+', min: 77 },
      { label: 'C', min: 73 },
      { label: 'C−', min: 70 },
      { label: 'D+', min: 67 },
      { label: 'D', min: 63 },
      { label: 'D−', min: 60 },
      { label: 'F', min: 0 }
    ]
  },
  {
    id: 'cn-primary',
    name: '优秀 / 良好 / 合格 / 待合格',
    bands: [
      { label: '优秀', min: 90 },
      { label: '良好', min: 75 },
      { label: '合格', min: 60 },
      { label: '待合格', min: 0 }
    ]
  },
  {
    id: 'cn-five',
    name: '优秀 / 良好 / 中等 / 及格 / 不及格',
    bands: [
      { label: '优秀', min: 90 },
      { label: '良好', min: 80 },
      { label: '中等', min: 70 },
      { label: '及格', min: 60 },
      { label: '不及格', min: 0 }
    ]
  },
  {
    id: 'one-to-seven',
    name: tr('1–7 (IB style)'),
    note: tr('Cut-offs vary by school and subject; adjust them to yours.'),
    bands: [
      { label: '7', min: 80 },
      { label: '6', min: 70 },
      { label: '5', min: 60 },
      { label: '4', min: 50 },
      { label: '3', min: 40 },
      { label: '2', min: 25 },
      { label: '1', min: 0 }
    ]
  },
  {
    id: 'nine-to-one',
    name: tr('9–1 (GCSE style)'),
    note: tr('Cut-offs change every year; adjust them to yours.'),
    bands: [
      { label: '9', min: 90 },
      { label: '8', min: 80 },
      { label: '7', min: 70 },
      { label: '6', min: 60 },
      { label: '5', min: 50 },
      { label: '4', min: 40 },
      { label: '3', min: 30 },
      { label: '2', min: 20 },
      { label: '1', min: 10 },
      { label: 'U', min: 0 }
    ]
  },
  {
    id: 'pass-fail',
    name: tr('Pass / Fail'),
    bands: [
      { label: tr('Pass'), min: 60 },
      { label: tr('Fail'), min: 0 }
    ]
  }
]

/** The class's bands, highest first. */
export function gradeBands(thresholds: GradeThresholds): GradeBand[] {
  if (thresholds.scale?.length) return [...thresholds.scale].sort((a, b) => b.min - a.min)
  return [
    { label: 'A', min: thresholds.A },
    { label: 'B', min: thresholds.B },
    { label: 'C', min: thresholds.C },
    { label: 'D', min: thresholds.D },
    { label: 'F', min: 0 }
  ]
}

export function letterForPercent(percent: number, thresholds: GradeThresholds): string {
  const bands = gradeBands(thresholds)
  return (bands.find((b) => percent >= b.min) ?? bands[bands.length - 1]).label
}

export type BandTone = 'success' | 'warning' | 'danger'

/** Colour for a band by its place in the scale: the top ~40% green, the lowest band red
 * (and, in scales of five or more, the bottom ~40%), the rest amber. For A–F this is
 * EduBoard's usual A/B green, C amber, D/F red. */
export function bandTone(label: string, thresholds: GradeThresholds): BandTone | null {
  const bands = gradeBands(thresholds)
  const i = bands.findIndex((b) => b.label === label)
  if (i === -1) return null
  const n = bands.length
  if (i === n - 1) return 'danger'
  if (n >= 5 && i >= Math.round(n * 0.6)) return 'danger'
  if (i < Math.max(1, Math.round(n * 0.4))) return 'success'
  return 'warning'
}

/** Problems with a scale the teacher is editing, in plain words, or null if it's fine. */
export function scaleProblem(bands: GradeBand[]): string | null {
  if (bands.length < 2) return tr('A scale needs at least two bands.')
  if (bands.some((b) => !b.label.trim())) return tr('Every band needs a name.')
  if (new Set(bands.map((b) => b.label.trim())).size !== bands.length)
    return tr('Two bands have the same name.')
  if (bands.some((b) => !Number.isFinite(b.min) || b.min < 0 || b.min > 100))
    return tr('Cut-offs must be between 0 and 100.')
  if (new Set(bands.map((b) => b.min)).size !== bands.length)
    return tr('Two bands have the same cut-off.')
  if (!bands.some((b) => b.min === 0)) return tr('The lowest band should start at 0.')
  return null
}

/** For a save button: this scale can be saved. */
export function gradeScaleIsValid(value: GradeThresholds): boolean {
  return !value.scale?.length || scaleProblem(gradeBands(value)) === null
}
