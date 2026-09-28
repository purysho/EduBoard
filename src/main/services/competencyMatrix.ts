import type {
  CompetencyEvidenceCell,
  CompetencyEvidenceSource,
  CompetencyMatrix,
  CompetencyMatrixStandard
} from '@shared/types'
import { getSqlite } from '../db/client'
import { getRosterForClass } from '../repositories/enrollments'

interface EvidenceRow {
  studentId: string
  standardId: string
  levelLabel: string
  updatedAt: string
  sourceId: string
  sourceName: string
  sourceType: CompetencyEvidenceSource
}

/**
 * Builds a Student × Standard evidence matrix from rubric selections already saved in
 * EduBoard. It stores no second "mastery" copy: assessment/homework rubric evidence is
 * the source of truth, so editing a rubric score immediately changes this view.
 *
 * The cell deliberately reports the most recent evidence source rather than calculating
 * a hidden average. When several criteria in that source map to the same standard, all
 * selected level labels are preserved: one agreed label is shown directly, while differing
 * labels are flagged as mixed evidence.
 */
export function getCompetencyMatrix(classId: string): CompetencyMatrix {
  const sqlite = getSqlite()

  const standards = sqlite
    .prepare(
      `
        SELECT DISTINCT s.id, s.code, s.description
        FROM standards s
        JOIN rubric_criteria rc ON rc.standard_id = s.id
        JOIN assessments a ON a.rubric_id = rc.rubric_id
        WHERE a.class_id = ?

        UNION

        SELECT DISTINCT s.id, s.code, s.description
        FROM standards s
        JOIN rubric_criteria rc ON rc.standard_id = s.id
        JOIN homework_assignments h ON h.rubric_id = rc.rubric_id
        WHERE h.class_id = ?

        ORDER BY code
      `
    )
    .all(classId, classId) as CompetencyMatrixStandard[]

  const students = getRosterForClass(classId)
    .filter(({ enrollment }) => enrollment.status === 'active')
    .map(({ student }) => ({
      id: student.id,
      name: [student.preferredName || student.firstName, student.lastName].filter(Boolean).join(' ')
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const rows = sqlite
    .prepare(
      `
        SELECT
          rs.student_id AS studentId,
          rc.standard_id AS standardId,
          rl.label AS levelLabel,
          rs.updated_at AS updatedAt,
          a.id AS sourceId,
          a.name AS sourceName,
          'assessment' AS sourceType
        FROM rubric_scores rs
        JOIN rubric_criteria rc ON rc.id = rs.criterion_id
        JOIN rubric_levels rl ON rl.id = rs.level_id
        JOIN assessments a ON a.id = rs.assessment_id
        WHERE a.class_id = ? AND rc.standard_id IS NOT NULL

        UNION ALL

        SELECT
          hrs.student_id AS studentId,
          rc.standard_id AS standardId,
          rl.label AS levelLabel,
          hrs.updated_at AS updatedAt,
          h.id AS sourceId,
          h.title AS sourceName,
          'homework' AS sourceType
        FROM homework_rubric_scores hrs
        JOIN rubric_criteria rc ON rc.id = hrs.criterion_id
        JOIN rubric_levels rl ON rl.id = hrs.level_id
        JOIN homework_assignments h ON h.id = hrs.homework_assignment_id
        WHERE h.class_id = ? AND rc.standard_id IS NOT NULL

        ORDER BY updatedAt ASC, sourceType ASC, sourceId ASC
      `
    )
    .all(classId, classId) as EvidenceRow[]

  const activeStudentIds = new Set(students.map((student) => student.id))
  const relevantStandardIds = new Set(standards.map((standard) => standard.id))
  const cells = new Map<string, CompetencyEvidenceCell>()

  for (const student of students) {
    for (const standard of standards) {
      cells.set(`${student.id}|${standard.id}`, {
        studentId: student.id,
        standardId: standard.id,
        latestLevelLabels: [],
        latestLevelLabel: null,
        latestEvidenceMixed: false,
        latestSourceType: null,
        latestSourceName: null,
        latestAt: null,
        evidenceCount: 0
      })
    }
  }

  const latestSourceKeys = new Map<string, string>()
  for (const row of rows) {
    if (!activeStudentIds.has(row.studentId) || !relevantStandardIds.has(row.standardId)) continue
    const key = `${row.studentId}|${row.standardId}`
    const cell = cells.get(key)
    if (!cell) continue
    cell.evidenceCount += 1

    const sourceKey = `${row.sourceType}|${row.sourceId}`
    if (!cell.latestAt || row.updatedAt > cell.latestAt) {
      cell.latestLevelLabels = [row.levelLabel]
      cell.latestSourceType = row.sourceType
      cell.latestSourceName = row.sourceName
      cell.latestAt = row.updatedAt
      latestSourceKeys.set(key, sourceKey)
      continue
    }

    if (row.updatedAt === cell.latestAt && latestSourceKeys.get(key) === sourceKey) {
      if (!cell.latestLevelLabels.includes(row.levelLabel)) {
        cell.latestLevelLabels.push(row.levelLabel)
      }
    }
  }

  for (const cell of cells.values()) {
    cell.latestEvidenceMixed = cell.latestLevelLabels.length > 1
    cell.latestLevelLabel = cell.latestLevelLabels.length === 1 ? cell.latestLevelLabels[0] : null
  }

  return {
    classId,
    standards,
    students,
    cells: [...cells.values()]
  }
}
