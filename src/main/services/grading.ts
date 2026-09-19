import type { GradeThresholds } from '@shared/types'

export interface AssessmentLike {
  id: string
  categoryId: string | null
  maxScore: number
}

export interface ScoreLike {
  assessmentId: string
  pointsEarned: number | null
  excused: boolean
}

export interface CategoryLike {
  id: string
  name: string
  weightPercent: number
}

export interface CategoryPercentResult {
  categoryId: string | null
  categoryName: string
  percent: number | null
  pointsEarned: number
  pointsPossible: number
}

const UNCATEGORIZED_NAME = 'General'

/**
 * Points-based average within one category: sum of earned points over sum of possible
 * points, counting only assessments that have actually been graded (a null score means
 * "not entered yet" and is left out entirely rather than treated as a zero). Excused
 * assessments never count against a student.
 */
export function computeCategoryPercent(
  assessments: AssessmentLike[],
  scoresByAssessmentId: Map<string, ScoreLike>
): { percent: number | null; pointsEarned: number; pointsPossible: number } {
  let earned = 0
  let possible = 0

  for (const assessment of assessments) {
    const score = scoresByAssessmentId.get(assessment.id)
    if (!score || score.pointsEarned === null || score.excused) continue
    earned += score.pointsEarned
    possible += assessment.maxScore
  }

  return {
    percent: possible > 0 ? (earned / possible) * 100 : null,
    pointsEarned: earned,
    pointsPossible: possible
  }
}

/**
 * Weighted category average for one student in one class. Categories with no graded
 * work yet are left out and the remaining weights are renormalized, so a class average
 * is always the average of *entered* evidence (matching "current grade is provisional,
 * normalized over what's been graded so far").
 */
export function computeClassGrade(
  categories: CategoryLike[],
  assessments: AssessmentLike[],
  scores: ScoreLike[]
): { percent: number | null; categoryBreakdown: CategoryPercentResult[] } {
  const scoresByAssessmentId = new Map(scores.map((s) => [s.assessmentId, s]))
  const assessmentsByCategory = new Map<string | null, AssessmentLike[]>()

  for (const assessment of assessments) {
    const key = assessment.categoryId
    const list = assessmentsByCategory.get(key) ?? []
    list.push(assessment)
    assessmentsByCategory.set(key, list)
  }

  const categoryList: CategoryLike[] =
    categories.length > 0
      ? categories
      : [{ id: '__uncategorized__', name: UNCATEGORIZED_NAME, weightPercent: 100 }]

  const breakdown: CategoryPercentResult[] = []
  let weightedSum = 0
  let weightUsed = 0

  for (const category of categoryList) {
    const key = categories.length > 0 ? category.id : null
    const categoryAssessments = assessmentsByCategory.get(key) ?? []
    const { percent, pointsEarned, pointsPossible } = computeCategoryPercent(
      categoryAssessments,
      scoresByAssessmentId
    )

    breakdown.push({
      categoryId: categories.length > 0 ? category.id : null,
      categoryName: category.name,
      percent,
      pointsEarned,
      pointsPossible
    })

    if (percent !== null) {
      weightedSum += percent * category.weightPercent
      weightUsed += category.weightPercent
    }
  }

  // Any assessments left uncategorized even though the class *does* define categories
  // (e.g. category was deleted out from under them) still count, folded in unweighted.
  if (categories.length > 0) {
    const orphaned = assessmentsByCategory.get(null) ?? []
    if (orphaned.length > 0) {
      const { percent, pointsEarned, pointsPossible } = computeCategoryPercent(
        orphaned,
        scoresByAssessmentId
      )
      breakdown.push({
        categoryId: null,
        categoryName: 'Uncategorized',
        percent,
        pointsEarned,
        pointsPossible
      })
      if (percent !== null) {
        weightedSum += percent * 100
        weightUsed += 100
      }
    }
  }

  return {
    percent: weightUsed > 0 ? weightedSum / weightUsed : null,
    categoryBreakdown: breakdown
  }
}

export function letterForPercent(percent: number, thresholds: GradeThresholds): string {
  if (percent >= thresholds.A) return 'A'
  if (percent >= thresholds.B) return 'B'
  if (percent >= thresholds.C) return 'C'
  if (percent >= thresholds.D) return 'D'
  return 'F'
}

export function isPassing(percent: number, passMark: number): boolean {
  return percent >= passMark
}
