import { describe, expect, it } from 'vitest'
import { computeClassGrade, letterForPercent, isPassing } from '../grading'

describe('computeClassGrade', () => {
  it('returns null when nothing has been graded yet', () => {
    const result = computeClassGrade(
      [{ id: 'c1', name: 'Homework', weightPercent: 100 }],
      [{ id: 'a1', categoryId: 'c1', maxScore: 100 }],
      [{ assessmentId: 'a1', pointsEarned: null, excused: false }]
    )
    expect(result.percent).toBeNull()
  })

  it('computes a points-based percent within a single uncategorized bucket', () => {
    const result = computeClassGrade(
      [],
      [
        { id: 'a1', categoryId: null, maxScore: 100 },
        { id: 'a2', categoryId: null, maxScore: 50 }
      ],
      [
        { assessmentId: 'a1', pointsEarned: 90, excused: false },
        { assessmentId: 'a2', pointsEarned: 40, excused: false }
      ]
    )
    // (90 + 40) / (100 + 50) = 86.67%
    expect(result.percent).toBeCloseTo(86.666, 2)
  })

  it('renormalizes weights when a category has no graded work yet', () => {
    const result = computeClassGrade(
      [
        { id: 'hw', name: 'Homework', weightPercent: 40 },
        { id: 'exam', name: 'Exams', weightPercent: 60 }
      ],
      [
        { id: 'a1', categoryId: 'hw', maxScore: 100 },
        { id: 'a2', categoryId: 'exam', maxScore: 100 }
      ],
      [{ assessmentId: 'a1', pointsEarned: 80, excused: false }]
    )
    // Only homework has evidence, so it is the whole grade regardless of its 40% weight.
    expect(result.percent).toBe(80)
  })

  it('excludes excused scores from both earned and possible points', () => {
    const result = computeClassGrade(
      [],
      [
        { id: 'a1', categoryId: null, maxScore: 100 },
        { id: 'a2', categoryId: null, maxScore: 100 }
      ],
      [
        { assessmentId: 'a1', pointsEarned: 70, excused: false },
        { assessmentId: 'a2', pointsEarned: 0, excused: true }
      ]
    )
    expect(result.percent).toBe(70)
  })

  it('blends weighted categories once both have evidence', () => {
    const result = computeClassGrade(
      [
        { id: 'hw', name: 'Homework', weightPercent: 30 },
        { id: 'exam', name: 'Exams', weightPercent: 70 }
      ],
      [
        { id: 'a1', categoryId: 'hw', maxScore: 100 },
        { id: 'a2', categoryId: 'exam', maxScore: 100 }
      ],
      [
        { assessmentId: 'a1', pointsEarned: 100, excused: false },
        { assessmentId: 'a2', pointsEarned: 50, excused: false }
      ]
    )
    // 100*0.3 + 50*0.7 = 65
    expect(result.percent).toBe(65)
  })
})

describe('letterForPercent', () => {
  const thresholds = { A: 90, B: 80, C: 70, D: 60 }

  it.each([
    [95, 'A'],
    [90, 'A'],
    [85, 'B'],
    [72, 'C'],
    [61, 'D'],
    [40, 'F']
  ])('maps %d%% to %s', (percent, letter) => {
    expect(letterForPercent(percent, thresholds)).toBe(letter)
  })
})

describe('isPassing', () => {
  it('is true at or above the pass mark', () => {
    expect(isPassing(60, 60)).toBe(true)
    expect(isPassing(59.9, 60)).toBe(false)
  })
})
