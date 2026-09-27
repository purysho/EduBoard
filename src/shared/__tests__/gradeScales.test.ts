import { describe, expect, it } from 'vitest'
import {
  bandTone,
  GRADE_SCALE_PRESETS,
  gradeBands,
  gradeScaleIsValid,
  letterForPercent,
  scaleProblem
} from '../gradeScales'
import { DEFAULT_GRADE_THRESHOLDS, type GradeThresholds } from '../types'

const withScale = (id: string): GradeThresholds => ({
  ...DEFAULT_GRADE_THRESHOLDS,
  scale: GRADE_SCALE_PRESETS.find((p) => p.id === id)!.bands!
})

describe('grading scales', () => {
  it('keeps EduBoard’s A–F exactly as before when a class has no scale', () => {
    const t = { A: 90, B: 80, C: 70, D: 60 }
    expect([95, 90, 89.9, 80, 70, 60, 59.9, 0].map((p) => letterForPercent(p, t))).toEqual([
      'A',
      'A',
      'B',
      'B',
      'C',
      'D',
      'F',
      'F'
    ])
  })

  it('uses a chosen scale’s bands, whatever order they were saved in', () => {
    const cn = withScale('cn-primary')
    expect([92, 80, 60, 10].map((p) => letterForPercent(p, cn))).toEqual([
      '优秀',
      '良好',
      '合格',
      '待合格'
    ])
    const shuffled = { ...cn, scale: [...cn.scale!].reverse() }
    expect(letterForPercent(80, shuffled)).toBe('良好')
    expect(letterForPercent(84, withScale('one-to-seven'))).toBe('7')
    expect(letterForPercent(5, withScale('nine-to-one'))).toBe('U')
  })

  it('colours bands by their place in the scale', () => {
    const cn = withScale('cn-five')
    expect(['优秀', '良好', '中等', '及格', '不及格'].map((l) => bandTone(l, cn))).toEqual([
      'success',
      'success',
      'warning',
      'danger',
      'danger'
    ])
    const af = DEFAULT_GRADE_THRESHOLDS
    expect(['A', 'B', 'C', 'D', 'F'].map((l) => bandTone(l, af))).toEqual([
      'success',
      'success',
      'warning',
      'danger',
      'danger'
    ])
    const cn4 = withScale('cn-primary')
    expect(['优秀', '良好', '合格', '待合格'].map((l) => bandTone(l, cn4))).toEqual([
      'success',
      'success',
      'warning',
      'danger'
    ])
    expect(['Pass', 'Fail'].map((l) => bandTone(l, withScale('pass-fail')))).toEqual([
      'success',
      'danger'
    ])
    expect(bandTone('Z', af)).toBeNull()
  })

  it('every preset is a valid scale', () => {
    for (const p of GRADE_SCALE_PRESETS) {
      if (p.bands) expect(scaleProblem(p.bands)).toBeNull()
    }
  })

  it('explains what’s wrong with a scale being edited', () => {
    expect(scaleProblem([{ label: 'Pass', min: 50 }])).toMatch(/two bands/)
    expect(
      scaleProblem([
        { label: 'Pass', min: 50 },
        { label: '', min: 0 }
      ])
    ).toMatch(/name/)
    expect(
      scaleProblem([
        { label: 'X', min: 50 },
        { label: 'X', min: 0 }
      ])
    ).toMatch(/same name/)
    expect(
      scaleProblem([
        { label: 'A', min: 50 },
        { label: 'B', min: 50 },
        { label: 'C', min: 0 }
      ])
    ).toMatch(/same cut-off/)
    expect(
      scaleProblem([
        { label: 'A', min: 50 },
        { label: 'B', min: 10 }
      ])
    ).toMatch(/start at 0/)
    expect(gradeScaleIsValid(DEFAULT_GRADE_THRESHOLDS)).toBe(true)
    expect(gradeBands(DEFAULT_GRADE_THRESHOLDS).map((b) => b.label)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'F'
    ])
  })
})
