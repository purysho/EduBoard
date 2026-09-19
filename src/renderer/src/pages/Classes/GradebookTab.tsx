import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import type { Assessment, AssignmentSubmission, ClassSection, Score } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { letterTone } from '@renderer/lib/grade'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useAssessments,
  useAssignmentSubmissionsByClass,
  useClassRoster,
  useDeleteAssessment,
  useGradeCategories,
  useRubrics,
  useScoresByClass
} from '@renderer/lib/queries'
import { formatDate, formatPercent, studentFullName } from '@renderer/lib/format'
import { AssessmentFormModal } from './AssessmentFormModal'
import { ScoreCell } from './ScoreCell'
import { RubricScoreCell } from './RubricScoreCell'

export function GradebookTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: categories } = useGradeCategories(classSection.id)
  const { data: assessments, isLoading } = useAssessments(classSection.id)
  const { data: roster } = useClassRoster(classSection.id)
  const { data: scores } = useScoresByClass(classSection.id)
  const { data: submissions } = useAssignmentSubmissionsByClass(classSection.id)
  const { data: rubrics } = useRubrics()
  const deleteAssessment = useDeleteAssessment(classSection.id)

  const rubricsById = useMemo(() => new Map((rubrics ?? []).map((r) => [r.id, r])), [rubrics])

  const [showAdd, setShowAdd] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Assessment | null>(null)

  const scoreMap = useMemo(() => {
    const map = new Map<string, Score>()
    for (const s of scores ?? []) map.set(`${s.assessmentId}:${s.studentId}`, s)
    return map
  }, [scores])

  const submissionMap = useMemo(() => {
    const map = new Map<string, AssignmentSubmission>()
    for (const s of submissions ?? []) map.set(`${s.assessmentId}:${s.studentId}`, s)
    return map
  }, [submissions])

  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1 inline" aria-hidden />
          Assessment
        </Button>
      </div>

      {!assessments?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description="Add an assessment (quiz, homework, exam…) to start entering grades."
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              Assessment
            </Button>
          }
        />
      ) : !roster?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No students enrolled"
          description="Enroll students from the Roster tab before entering grades."
        />
      ) : (
        <div className="overflow-auto rounded-xl border border-[var(--color-border)]">
          <table className="text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
              <tr>
                <th className="sticky left-0 z-10 min-w-48 border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-left font-medium">
                  Student
                </th>
                {assessments.map((a) => (
                  <th key={a.id} className="min-w-24 px-2 py-2 text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        className="line-clamp-2 hover:text-[var(--color-primary)]"
                        title={a.name}
                        onClick={() => setEditingAssessment(a)}
                      >
                        {a.name}
                      </button>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        /{a.maxScore}
                        {a.categoryId && ` · ${categoryName.get(a.categoryId) ?? ''}`}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {formatDate(a.assessmentDate, 'MMM d')}
                      </span>
                      <button
                        className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => setPendingDelete(a)}
                      >
                        remove
                      </button>
                    </div>
                  </th>
                ))}
                <th className="min-w-20 px-3 py-2 text-center font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((row, rowIndex) => (
                <tr key={row.student.id} className="border-t border-[var(--color-border)]">
                  <td className="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 font-medium">
                    <Link
                      to={`/students/${row.student.id}`}
                      className="hover:text-[var(--color-primary)]"
                    >
                      {studentFullName(row.student)}
                    </Link>
                  </td>
                  {assessments.map((a, colIndex) => {
                    const rubric = a.rubricId ? rubricsById.get(a.rubricId) : undefined
                    return (
                      <td key={a.id} className="px-2 py-1 text-center">
                        {rubric ? (
                          <RubricScoreCell
                            classId={classSection.id}
                            assessmentId={a.id}
                            studentId={row.student.id}
                            studentName={studentFullName(row.student)}
                            rubric={rubric}
                            score={scoreMap.get(`${a.id}:${row.student.id}`)}
                          />
                        ) : (
                          <ScoreCell
                            classId={classSection.id}
                            assessmentId={a.id}
                            studentId={row.student.id}
                            maxScore={a.maxScore}
                            score={scoreMap.get(`${a.id}:${row.student.id}`)}
                            submission={submissionMap.get(`${a.id}:${row.student.id}`)}
                            row={rowIndex}
                            col={colIndex}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{formatPercent(row.grade.percent)}</span>
                      {row.grade.letter && (
                        <Badge tone={letterTone(row.grade.letter)}>{row.grade.letter}</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AssessmentFormModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        classId={classSection.id}
        categories={categories ?? []}
      />
      {editingAssessment && (
        <AssessmentFormModal
          open
          onClose={() => setEditingAssessment(null)}
          classId={classSection.id}
          categories={categories ?? []}
          assessment={editingAssessment}
        />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete assessment"
        message={`Delete "${pendingDelete?.name}"? All recorded scores for it will be deleted too.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (pendingDelete) await deleteAssessment.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
