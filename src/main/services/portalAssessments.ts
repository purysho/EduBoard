import { inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { rubricScores } from '../db/schema'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listGradeCategories } from '../repositories/gradeCategories'
import { getRubric } from '../repositories/rubrics'
import { listScoresByClass } from '../repositories/scores'
import type { PortalScoreOptions, RubricScore, RubricWithCriteria } from '@shared/types'

/** The class average is shown only when at least this many students have a score, so a
 * family can't work out another student's mark from it. */
export const MIN_SCORES_FOR_CLASS_AVERAGE = 5
const MAX_COMMENT_LENGTH = 2000

export interface PortalAssessment {
  id: string
  classId: string
  name: string
  category: string | null
  date: string | null
  maxScore: number
  /** Percent, one decimal; null when hidden or when too few students have a score. */
  classAverage: number | null
}

export interface PortalAssessmentScore {
  assessmentId: string
  studentId: string
  points: number | null
  excused: boolean
  late: boolean
  comment: string | null
  /** For a rubric-marked assessment: the level reached on each criterion. */
  rubric: { criterion: string; level: string; points: number; maxPoints: number }[] | null
}

/** What a publish sends about one class's assessments: only assessments at least one of
 * these students has been marked on (so one set up ahead of time stays private), and only
 * these students' own scores. */
export function portalAssessmentsForClass(
  classId: string,
  studentIds: Set<string>,
  options: PortalScoreOptions
): { assessments: PortalAssessment[]; scores: PortalAssessmentScore[] } {
  if (!options.assessments || !studentIds.size) return { assessments: [], scores: [] }

  const categoryNames = new Map(listGradeCategories(classId).map((c) => [c.id, c.name]))
  const recorded = listScoresByClass(classId).filter(
    (s) => studentIds.has(s.studentId) && (s.pointsEarned !== null || s.excused)
  )
  const markedIds = new Set(recorded.map((s) => s.assessmentId))
  const list = listAssessmentsByClass(classId)
    .filter((a) => markedIds.has(a.id))
    .sort(
      (a, b) =>
        (a.assessmentDate ?? '9999').localeCompare(b.assessmentDate ?? '9999') ||
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt)
    )

  const rubrics = new Map<string, RubricWithCriteria>()
  for (const a of list) {
    if (a.rubricId && !rubrics.has(a.rubricId)) {
      const rubric = getRubric(a.rubricId)
      if (rubric) rubrics.set(a.rubricId, rubric)
    }
  }
  const rubricRows = list.some((a) => a.rubricId && rubrics.has(a.rubricId))
    ? (getDb()
        .select()
        .from(rubricScores)
        .where(
          inArray(
            rubricScores.assessmentId,
            list.map((a) => a.id)
          )
        )
        .all() as RubricScore[])
    : []
  const rubricKey = (assessmentId: string, studentId: string): string =>
    `${assessmentId}\n${studentId}`
  const rubricByScore = new Map<string, RubricScore[]>()
  for (const row of rubricRows) {
    const key = rubricKey(row.assessmentId, row.studentId)
    rubricByScore.set(key, [...(rubricByScore.get(key) ?? []), row])
  }

  const assessments: PortalAssessment[] = list.map((a) => {
    const percents = recorded
      .filter((s) => s.assessmentId === a.id && !s.excused && s.pointsEarned !== null)
      .map((s) => ((s.pointsEarned as number) / a.maxScore) * 100)
    const average =
      options.classAverage && a.maxScore > 0 && percents.length >= MIN_SCORES_FOR_CLASS_AVERAGE
        ? Math.round((percents.reduce((x, y) => x + y, 0) / percents.length) * 10) / 10
        : null
    return {
      id: a.id,
      classId,
      name: a.name,
      category: a.categoryId ? (categoryNames.get(a.categoryId) ?? null) : null,
      date: a.assessmentDate,
      maxScore: a.maxScore,
      classAverage: average
    }
  })

  const byId = new Map(list.map((a) => [a.id, a]))
  const scores: PortalAssessmentScore[] = recorded
    .filter((s) => byId.has(s.assessmentId))
    .map((s) => {
      const assessment = byId.get(s.assessmentId)!
      const rubric = assessment.rubricId ? rubrics.get(assessment.rubricId) : undefined
      const chosen = rubric ? (rubricByScore.get(rubricKey(s.assessmentId, s.studentId)) ?? []) : []
      const comment = options.comments ? s.comment?.trim().slice(0, MAX_COMMENT_LENGTH) : ''
      return {
        assessmentId: s.assessmentId,
        studentId: s.studentId,
        points: s.excused ? null : s.pointsEarned,
        excused: s.excused,
        late: s.late,
        comment: comment || null,
        rubric:
          rubric && chosen.length
            ? rubric.criteria.flatMap((c) => {
                const level = c.levels.find(
                  (l) => l.id === chosen.find((r) => r.criterionId === c.id)?.levelId
                )
                if (!level) return []
                return [
                  {
                    criterion: c.name,
                    level: level.label,
                    points: level.points,
                    maxPoints: c.levels.reduce((max, l) => Math.max(max, l.points), 0)
                  }
                ]
              })
            : null
      }
    })

  return { assessments, scores }
}
