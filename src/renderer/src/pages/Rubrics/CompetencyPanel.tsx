import { useEffect, useMemo, useState } from 'react'
import { Grid3X3 } from 'lucide-react'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useClasses, useCompetencyMatrix } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'

export function CompetencyPanel(): React.JSX.Element {
  const { data: classes, isLoading: classesLoading } = useClasses()
  const activeClasses = useMemo(() => classes?.filter((cls) => !cls.archived) ?? [], [classes])
  const [classId, setClassId] = useState('')

  useEffect(() => {
    if (!classId && activeClasses.length) setClassId(activeClasses[0].id)
    else if (classId && !activeClasses.some((cls) => cls.id === classId)) {
      setClassId(activeClasses[0]?.id ?? '')
    }
  }, [activeClasses, classId])

  const { data: matrix, isLoading: matrixLoading } = useCompetencyMatrix(classId || undefined)

  if (classesLoading) return <Spinner />

  if (!activeClasses.length) {
    return (
      <EmptyState
        icon={Grid3X3}
        title={tr('No active classes')}
        description={tr('Add a class before viewing competency evidence.')}
      />
    )
  }

  const cellByKey = new Map(
    matrix?.cells.map((cell) => [`${cell.studentId}|${cell.standardId}`, cell]) ?? []
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl space-y-1">
              <h2 className="text-sm font-semibold">{tr('Competency evidence')}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {tr(
                  'Derived from rubric grading already in EduBoard. Nothing is averaged into a hidden mastery score: each cell shows the newest assessment or homework evidence for that standard.'
                )}
              </p>
            </div>
            <label className="min-w-64 space-y-1 text-xs">
              <span className="block font-medium text-[var(--color-text-muted)]">
                {tr('Class')}
              </span>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-sm"
              >
                {activeClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                    {cls.subject ? ` · ${cls.subject}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardBody>
      </Card>

      {matrixLoading ? (
        <Spinner />
      ) : !matrix?.standards.length ? (
        <EmptyState
          icon={Grid3X3}
          title={tr('No competency evidence yet')}
          description={tr(
            'Link rubric criteria to standards, use those rubrics on assessments or homework, and grade at least one student.'
          )}
        />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                  <th className="sticky left-0 z-10 min-w-44 bg-[var(--color-surface-muted)] px-3 py-2 text-left font-semibold">
                    {tr('Student')}
                  </th>
                  {matrix.standards.map((standard) => (
                    <th
                      key={standard.id}
                      className="w-36 max-w-36 border-l border-[var(--color-border)] px-2 py-2 text-left align-bottom"
                      title={standard.description}
                    >
                      <div className="font-semibold">{standard.code}</div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[var(--color-text-muted)]">
                        {standard.description}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.students.map((student) => (
                  <tr key={student.id} className="border-b border-[var(--color-border)] last:border-b-0">
                    <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-2 text-left font-medium">
                      {student.name}
                    </th>
                    {matrix.standards.map((standard) => {
                      const cell = cellByKey.get(`${student.id}|${standard.id}`)
                      const labels = cell?.latestLevelLabels ?? []
                      const source =
                        cell?.latestSourceName && cell.latestSourceType
                          ? tr('{type}: {name}', {
                              type:
                                cell.latestSourceType === 'assessment'
                                  ? tr('Assessment')
                                  : tr('Homework'),
                              name: cell.latestSourceName
                            })
                          : null
                      const title = cell?.evidenceCount
                        ? [
                            source,
                            cell.latestAt
                              ? tr('Updated {date}', { date: formatDate(cell.latestAt) })
                              : null,
                            trn(
                              '{n} rubric criterion linked to this standard',
                              '{n} rubric criteria linked to this standard',
                              cell.evidenceCount
                            )
                          ]
                            .filter(Boolean)
                            .join('\n')
                        : tr('No rubric evidence for this student and standard yet.')

                      return (
                        <td
                          key={standard.id}
                          className="border-l border-[var(--color-border)] px-2 py-2 align-top"
                          title={title}
                        >
                          {!cell?.evidenceCount ? (
                            <span className="text-[var(--color-text-muted)]">—</span>
                          ) : cell.latestEvidenceMixed ? (
                            <div>
                              <div className="font-medium">{tr('Mixed evidence')}</div>
                              <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                                {labels.join(' · ')}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{cell.latestLevelLabel}</div>
                              {source && (
                                <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-text-muted)]">
                                  {source}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
