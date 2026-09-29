import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpenCheck, Map } from 'lucide-react'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Field'
import { cn } from '@renderer/lib/cn'
import { formatDate } from '@renderer/lib/format'
import { useClasses, useCourseGroups, useCurriculumMap } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'
import type { CurriculumMapScopeType, LessonPlanStatus } from '@shared/types'

const STATUS_TONE = {
  planned: 'primary',
  taught: 'success',
  skipped: 'neutral'
} as const

function scopeValue(type: CurriculumMapScopeType, id: string): string {
  return `${type}:${id}`
}

function splitScope(value: string): { type: CurriculumMapScopeType; id: string } | null {
  const colon = value.indexOf(':')
  if (colon < 1) return null
  const type = value.slice(0, colon)
  const id = value.slice(colon + 1)
  if ((type !== 'courseGroup' && type !== 'class') || !id) return null
  return { type, id }
}

function StatusBadge({ status }: { status: LessonPlanStatus }): React.JSX.Element {
  return <Badge tone={STATUS_TONE[status]}>{tr(status)}</Badge>
}

export function CurriculumMapPage(): React.JSX.Element {
  const { data: courseGroups, isLoading: loadingGroups } = useCourseGroups()
  const { data: classes, isLoading: loadingClasses } = useClasses(true)
  const [selected, setSelected] = useState('')

  const activeClasses = useMemo(() => classes?.filter((cls) => !cls.archived) ?? [], [classes])
  const defaultSelected = courseGroups?.length
    ? scopeValue('courseGroup', courseGroups[0].id)
    : activeClasses[0]
      ? scopeValue('class', activeClasses[0].id)
      : classes?.[0]
        ? scopeValue('class', classes[0].id)
        : ''
  const effectiveSelected = selected || defaultSelected

  const scope = splitScope(effectiveSelected)
  const { data: map, isLoading: loadingMap } = useCurriculumMap(scope?.type, scope?.id)
  const loading = loadingGroups || loadingClasses
  const standardsWithoutTaughtLessons =
    map?.standardCoverage.filter((row) => row.lessonCount > 0 && row.taughtCount === 0) ?? []

  return (
    <div>
      <PageHeader
        title={tr('Curriculum Map')}
        description={tr(
          'Track what was planned, taught, moved or skipped across a whole course or one class.'
        )}
      />

      {loading ? (
        <Spinner />
      ) : !courseGroups?.length && !classes?.length ? (
        <EmptyState
          icon={Map}
          title={tr('No curriculum to map yet')}
          description={tr('Add a class and lesson plans first.')}
        />
      ) : (
        <>
          <Card className="mb-4">
            <CardBody>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="text-sm font-semibold">{tr('Curriculum scope')}</h2>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {tr(
                      'Course groups combine linked term classes into one sequence. Choose a class to inspect only that term or section.'
                    )}
                  </p>
                </div>
                <div className="w-full max-w-sm">
                  <Select
                    value={effectiveSelected}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    {!!courseGroups?.length && (
                      <optgroup label={tr('Course groups')}>
                        {courseGroups.map((group) => (
                          <option key={group.id} value={scopeValue('courseGroup', group.id)}>
                            {group.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {!!classes?.length && (
                      <optgroup label={tr('Classes')}>
                        {classes.map((cls) => (
                          <option key={cls.id} value={scopeValue('class', cls.id)}>
                            {cls.name}
                            {cls.archived ? ` · ${tr('Archived')}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                </div>
              </div>
            </CardBody>
          </Card>

          {!effectiveSelected || loadingMap ? (
            <Spinner />
          ) : !map ? null : !map.lessons.length && !map.unlinkedAssessments.length ? (
            <EmptyState
              icon={Map}
              title={tr('No mapped lessons yet')}
              description={tr('Add lesson plans to this class or course to build the map.')}
            />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  [tr('Lessons'), map.summary.total],
                  [tr('Taught'), map.summary.taught],
                  [tr('Planned'), map.summary.planned],
                  [tr('Skipped'), map.summary.skipped],
                  [tr('Moved'), map.summary.moved]
                ].map(([label, value]) => (
                  <Card key={String(label)}>
                    <CardBody className="py-4">
                      <div className="text-2xl font-semibold">{value}</div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">{label}</div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {!!map.nextLessonId && (
                <Card>
                  <CardBody>
                    {(() => {
                      const next = map.lessons.find((lesson) => lesson.id === map.nextLessonId)
                      if (!next) return null
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                              {tr('Next planned lesson')}
                            </div>
                            <div className="mt-1 font-semibold">{next.title}</div>
                            <div className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                              {formatDate(next.date)} · {next.termName ?? next.className}
                            </div>
                          </div>
                          <Link
                            to={`/classes/${next.classId}/lessons`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                          >
                            {tr('Open lesson plans')}
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        </div>
                      )
                    })()}
                  </CardBody>
                </Card>
              )}

              {!!map.standardCoverage.length && (
                <Card>
                  <CardBody className="p-0">
                    <div className="border-b border-[var(--color-border)] px-4 py-3">
                      <h2 className="text-sm font-semibold">{tr('Standard coverage')}</h2>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {tr('Counts reflect lesson status; planned lessons are not treated as taught.')}
                      </p>
                      {!!standardsWithoutTaughtLessons.length && (
                        <div className="mt-3 rounded-md border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] p-2.5">
                          <div className="text-xs font-medium">
                            {tr('No taught lesson yet for:')}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {standardsWithoutTaughtLessons.map((row) => (
                              <Badge key={row.code} tone="neutral">
                                {row.code} · {row.plannedCount + row.skippedCount}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">{tr('Standard')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('Lessons')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('Taught')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('Planned')}</th>
                            <th className="px-3 py-2 text-center font-medium">{tr('Skipped')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {map.standardCoverage.map((row) => (
                            <tr key={row.code} className="border-t border-[var(--color-border)]">
                              <td className="px-4 py-2 font-medium">{row.code}</td>
                              <td className="px-3 py-2 text-center">{row.lessonCount}</td>
                              <td className="px-3 py-2 text-center">{row.taughtCount}</td>
                              <td className="px-3 py-2 text-center">{row.plannedCount}</td>
                              <td className="px-3 py-2 text-center">{row.skippedCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              )}

              {map.sections.map((section) => {
                const lessons = map.lessons.filter((lesson) => lesson.classId === section.classId)
                if (!lessons.length) return null
                return (
                  <Card key={section.classId}>
                    <CardBody className="p-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                        <div>
                          <h2 className="text-sm font-semibold">
                            {section.termName ?? section.className}
                          </h2>
                          {section.termName && section.termName !== section.className && (
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                              {section.className}
                            </p>
                          )}
                        </div>
                        <Link
                          to={`/classes/${section.classId}/lessons`}
                          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {tr('Edit lesson plans')}
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                          <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
                            <tr>
                              <th className="w-32 px-4 py-2 text-left font-medium">{tr('Date')}</th>
                              <th className="w-24 px-3 py-2 text-left font-medium">{tr('Status')}</th>
                              <th className="px-3 py-2 text-left font-medium">{tr('Lesson')}</th>
                              <th className="w-44 px-3 py-2 text-left font-medium">{tr('Standards')}</th>
                              <th className="w-44 px-3 py-2 text-left font-medium">{tr('Assessment')}</th>
                              <th className="w-52 px-3 py-2 text-left font-medium">{tr('Resources')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lessons.map((lesson) => (
                              <tr
                                key={lesson.id}
                                className={cn(
                                  'border-t border-[var(--color-border)] align-top',
                                  lesson.id === map.nextLessonId &&
                                    'bg-[var(--color-primary-soft)]/40'
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div>{formatDate(lesson.date)}</div>
                                  {lesson.moved && lesson.originalDate && (
                                    <div className="mt-1 text-[11px] text-[var(--color-warning)]">
                                      {tr('Moved from {date}', {
                                        date: formatDate(lesson.originalDate)
                                      })}
                                    </div>
                                  )}
                                  {lesson.weekLabel && (
                                    <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                      {lesson.weekLabel}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <StatusBadge status={lesson.status} />
                                </td>
                                <td className="px-3 py-3">
                                  <div className="font-medium">{lesson.title}</div>
                                  {lesson.id === map.nextLessonId && (
                                    <div className="mt-1 text-[11px] font-medium text-[var(--color-primary)]">
                                      {tr('Next')}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  {lesson.standards.length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {lesson.standards.map((code) => (
                                        <Badge key={code} tone="neutral">
                                          {code}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[var(--color-text-muted)]">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  {lesson.assessment ? (
                                    <div>
                                      <div>{lesson.assessment.name}</div>
                                      {lesson.assessment.date && (
                                        <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                          {formatDate(lesson.assessment.date)}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[var(--color-text-muted)]">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  {lesson.resources.length ? (
                                    <ul className="space-y-1">
                                      {lesson.resources.map((resource) => (
                                        <li key={resource.id} className="flex items-start gap-1.5">
                                          <BookOpenCheck
                                            size={13}
                                            className="mt-0.5 shrink-0 text-[var(--color-text-muted)]"
                                            aria-hidden
                                          />
                                          <span>{resource.title}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-[var(--color-text-muted)]">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}

              {!!map.unlinkedAssessments.length && (
                <Card>
                  <CardBody>
                    <h2 className="text-sm font-semibold">{tr('Unplaced assessments')}</h2>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {tr(
                        'These assessments exist in the selected curriculum but are not linked to a lesson plan yet.'
                      )}
                    </p>
                    <div className="mt-3 divide-y divide-[var(--color-border)]">
                      {map.unlinkedAssessments.map((assessment) => (
                        <div
                          key={assessment.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                        >
                          <div>
                            <div className="text-sm font-medium">{assessment.name}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              {assessment.className}
                            </div>
                          </div>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {assessment.date ? formatDate(assessment.date) : tr('No date')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
