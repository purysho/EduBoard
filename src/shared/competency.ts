export const COMPETENCY_STATES = [
  'not_evidenced',
  'emerging',
  'developing',
  'secure',
  'strong'
] as const

export type CompetencyState = (typeof COMPETENCY_STATES)[number]

export interface CompetencyEvidence {
  assessmentId: string
  assessmentName: string
  assessmentDate: string | null
  /** Average of criterion points / criterion max points for this standard in this assessment. */
  ratio: number
  criteriaScored: number
}

export interface CompetencyCell {
  state: CompetencyState
  /** 0-1 average across up to the three most recent assessment samples; null with no evidence. */
  ratio: number | null
  evidenceCount: number
  latestEvidence: CompetencyEvidence | null
}

export interface CompetencyMatrixStandard {
  id: string
  code: string
  description: string
}

export interface CompetencyMatrixStudent {
  studentId: string
  studentName: string
  competencies: Record<string, CompetencyCell>
}

export interface CompetencyMatrix {
  classId: string
  standards: CompetencyMatrixStandard[]
  students: CompetencyMatrixStudent[]
}

/**
 * Converts a normalized rubric-evidence ratio to the five simple competency states.
 *
 * Rubric families commonly use 0/1/2/3/4 points; the boundaries are midpoints between
 * those normalized levels, so 1/4 -> Emerging, 2/4 -> Developing, 3/4 -> Secure,
 * and 4/4 -> Strong. A selected zero-point level (or no evidence) remains Not yet evidenced.
 */
export function competencyStateFromRatio(ratio: number | null): CompetencyState {
  if (ratio === null || ratio <= 0) return 'not_evidenced'
  if (ratio < 0.375) return 'emerging'
  if (ratio < 0.625) return 'developing'
  if (ratio < 0.875) return 'secure'
  return 'strong'
}
