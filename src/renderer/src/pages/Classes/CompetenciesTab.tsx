import { useState } from 'react'
import { Search, Target } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useCompetencyMatrix } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

export function CompetenciesTab(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>()
  const { data: matrix, isLoading } = useCompetencyMatrix(classId)
  const [query, setQuery] = useState('')

  if (isLoading) return <Spinner />
  if (!matrix || matrix.standards.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={tr('No rubric-linked standards yet')}
        description={tr(
          'Link Standards to rubric criteria, attach those rubrics to an assessment or homework task, then grade student work. EduBoard will build the competency evidence matrix automatically.'
        )}
      />
    )
  }

  const byCell = new Map(matrix.cells.map((cell) => [`${cell.studentId}|${cell.standardId}`, cell]))
  const normalizedQuery = query.trim().toLowerCase()
  const visibleStudents = normalizedQuery
    ? matrix.students.filter((student) => student.name.toLowerCase().includes(normalizedQuery))
    : matrix.students

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-sm font-semibold">{tr('Competency evidence')}</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Each cell shows the newest rubric evidence recorded for that student and Standard. If several criteria in that same task disagree, EduBoard shows mixed evidence instead of inventing an average.'
            )}
              </p>
            </div>
            <label className="relative w-full max-w-xs">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-2.5 text-[var(--color-text-muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tr('Search students…')}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-2.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {tr('Showing {shown} of {total} students', {
              shown: visibleStudents.length,
              total: matrix.students.length
            })}
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <th className="sticky left-0 z-10 min-w-44 bg-[var(--color-surface-muted)] px-3 py-2 text-left font-medium">
                  {tr('Student')}
                </th>
                {matrix.standards.map((standard) => (
                  <th
                    key={standard.id}
                    title={standard.description}
                    className="min-w-40 px-3 py-2 text-left align-bottom font-medium"
                  >
                    <span className="block">{standard.code}</span>
                    <span className="mt-0.5 block max-w-48 text-xs font-normal text-[var(--color-text-muted)]">
                      {standard.description}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-3 text-left font-medium">
                    {student.name}
                  </th>
                  {matrix.standards.map((standard) => {
                    const cell = byCell.get(`${student.id}|${standard.id}`)
                    const source = cell?.latestSourceName
                    const hasEvidence = !!cell && cell.evidenceCount > 0
                    const level = !hasEvidence
                      ? tr('Not yet evidenced')
                      : cell.latestEvidenceMixed
                        ? tr('Mixed evidence')
                        : cell.latestLevelLabel
                    return (
                      <td key={standard.id} className="px-3 py-3 align-top">
                        <div className="font-medium">{level}</div>
                        {cell?.latestEvidenceMixed && (
                          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {cell.latestLevelLabels.join(' · ')}
                          </div>
                        )}
                        {hasEvidence ? (
                          <div className="mt-1 space-y-0.5 text-xs text-[var(--color-text-muted)]">
                            <div>
                              {tr('{n} evidence item(s)', { n: cell.evidenceCount })}
                            </div>
                            {source && (
                              <div title={source} className="max-w-44 truncate">
                                {tr('Latest: {source}', { source })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {tr('No rubric evidence recorded')}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {visibleStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={matrix.standards.length + 1}
                    className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]"
                  >
                    {tr('No students match that search.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <p className="text-xs text-[var(--color-text-muted)]">
        {tr(
          'This view does not calculate a separate mastery grade. It reflects the rubric evidence already stored in EduBoard, so changing a rubric score changes this matrix too.'
        )}
      </p>
    </div>
  )
}
