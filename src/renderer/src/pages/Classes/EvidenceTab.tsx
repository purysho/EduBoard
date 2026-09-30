import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ClassSection, LessonEvidenceValue } from '@shared/types'
import {
  useClassRoster,
  useLessonEvidence,
  useLessonPlans,
  useUpsertLessonEvidence
} from '@renderer/lib/queries'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { studentFullName, todayIso } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

const VALUES: (LessonEvidenceValue | null)[] = [null, '✓', '1', '2', '3', '4', '5', 'M', 'N']

function nextValue(value: LessonEvidenceValue | null, backwards = false): LessonEvidenceValue | null {
  const index = Math.max(0, VALUES.indexOf(value))
  return VALUES[(index + (backwards ? VALUES.length - 1 : 1)) % VALUES.length]
}

function tone(value: LessonEvidenceValue | null): string {
  if (value === '✓' || value === '4' || value === '5') {
    return 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
  }
  if (value === 'M') return 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
  if (value === 'N') return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
  if (value) return 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
  return 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
}

export function EvidenceTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: roster, isLoading: rosterLoading } = useClassRoster(classSection.id)
  const { data: lessons, isLoading: lessonsLoading } = useLessonPlans(classSection.id)
  const { data: evidence, isLoading: evidenceLoading } = useLessonEvidence(classSection.id)
  const save = useUpsertLessonEvidence(classSection.id)
  const today = todayIso()

  const students = useMemo(
    () =>
      (roster ?? [])
        .filter((row) => row.enrollment.status === 'active')
        .sort((a, b) => studentFullName(a.student).localeCompare(studentFullName(b.student))),
    [roster]
  )
  const cells = useMemo(
    () => new Map((evidence ?? []).map((item) => [`${item.lessonPlanId}:${item.studentId}`, item])),
    [evidence]
  )

  if (rosterLoading || lessonsLoading || evidenceLoading) return <Spinner />
  if (!lessons?.length) {
    return (
      <EmptyState
        title={tr('No lesson plans yet.')}
        description={tr('Add lesson plans first; each lesson becomes one evidence column.')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{tr('Evidence Grid')}</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {tr('One quick mark per student per lesson. Click forward; Shift-click goes back.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              <span className="rounded px-2 py-1 bg-[var(--color-success-soft)] text-[var(--color-success)]">✓ {tr('complete')}</span>
              <span className="rounded px-2 py-1 bg-[var(--color-primary-soft)] text-[var(--color-primary)]">1–5 {tr('ladder step')}</span>
              <span className="rounded px-2 py-1 bg-[var(--color-danger-soft)] text-[var(--color-danger)]">M {tr('missing')}</span>
              <span className="rounded px-2 py-1 bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">N {tr('not observed')}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-auto">
            <table className="min-w-max border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-surface-muted)]">
                  <th className="sticky left-0 z-20 min-w-44 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-left font-medium">
                    {tr('Student')}
                  </th>
                  {lessons.map((lesson) => (
                    <th
                      key={lesson.id}
                      className={`w-20 max-w-20 border-b border-r border-[var(--color-border)] px-1 py-2 text-center font-medium ${lesson.date === today ? 'bg-[var(--color-primary-soft)]' : ''}`}
                      title={lesson.title}
                    >
                      <div>{lesson.date.slice(5)}</div>
                      <div className="mt-1 truncate text-[10px] font-normal text-[var(--color-text-muted)]">
                        {lesson.weekLabel || lesson.title}
                      </div>
                    </th>
                  ))}
                  <th className="border-b border-[var(--color-border)] px-3 py-2 text-center font-medium">
                    {tr('Evidence')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => {
                  const recorded = lessons.reduce(
                    (count, lesson) =>
                      count + (cells.has(`${lesson.id}:${row.student.id}`) ? 1 : 0),
                    0
                  )
                  return (
                    <tr key={row.student.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-medium">
                        {studentFullName(row.student)}
                      </td>
                      {lessons.map((lesson) => {
                        const key = `${lesson.id}:${row.student.id}`
                        const value = cells.get(key)?.value ?? null
                        return (
                          <td
                            key={lesson.id}
                            className={`border-r border-[var(--color-border)] p-1 text-center ${lesson.date === today ? 'bg-[var(--color-primary-soft)]/30' : ''}`}
                          >
                            <button
                              type="button"
                              title={tr('{student} · {lesson}', {
                                student: studentFullName(row.student),
                                lesson: lesson.title
                              })}
                              className={`h-8 w-10 rounded-md font-semibold transition-colors ${tone(value)}`}
                              onClick={(event) =>
                                save.mutate({
                                  lessonPlanId: lesson.id,
                                  studentId: row.student.id,
                                  value: nextValue(value, event.shiftKey)
                                })
                              }
                            >
                              {value ?? '·'}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center text-[var(--color-text-muted)]">
                        {recorded}/{lessons.length}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
