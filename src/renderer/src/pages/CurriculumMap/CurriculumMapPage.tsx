import { useState } from 'react'
import { BookOpen, MapPinned } from 'lucide-react'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { Select } from '@renderer/components/ui/Field'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { useCourseGroups, useCurriculumMap } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

export function CurriculumMapPage(): React.JSX.Element {
  const { data: courseGroups, isLoading: loadingGroups } = useCourseGroups()
  const [courseGroupId, setCourseGroupId] = useState('')
  const { data: curriculum, isLoading } = useCurriculumMap(courseGroupId || undefined)

  return (
    <div>
      <PageHeader
        title={tr('Curriculum Map')}
        description={tr(
          'See how a course group’s terms, lesson sequence, Standards, assessments and Resources fit together.'
        )}
      />

      {loadingGroups ? (
        <Spinner />
      ) : !courseGroups?.length ? (
        <EmptyState
          icon={MapPinned}
          title={tr('No course groups yet')}
          description={tr(
            'Link classes to a course group from each class’s Settings tab, then their curriculum can be viewed together here.'
          )}
        />
      ) : (
        <>
          <div className="mb-5 max-w-sm">
            <Select value={courseGroupId} onChange={(event) => setCourseGroupId(event.target.value)}>
              <option value="">{tr('Select a course…')}</option>
              {courseGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </div>

          {!courseGroupId ? null : isLoading ? (
            <Spinner />
          ) : !curriculum?.classes.length ? (
            <EmptyState
              icon={MapPinned}
              title={tr('No classes in this course group')}
              description={tr(
                'Add at least one class to this course group before building its curriculum map.'
              )}
            />
          ) : (
            <div className="space-y-5">
              {curriculum.classes.map((section) => {
                const complete = section.lessons.filter((lesson) => lesson.status === 'completed').length
                return (
                  <Card key={section.classId}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{section.termName ?? section.className}</h2>
                          {section.termName && section.className !== section.termName && (
                            <p className="text-xs text-[var(--color-text-muted)]">{section.className}</p>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {tr('{complete} of {total} lessons completed', {
                            complete,
                            total: section.lessons.length
                          })}
                        </p>
                      </div>
                    </CardHeader>
                    <CardBody className="p-0">
                      {!section.lessons.length ? (
                        <div className="p-4 text-sm text-[var(--color-text-muted)]">
                          {tr('No lesson plans in this class yet.')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[900px] text-sm">
                            <thead className="border-y border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">{tr('Date')}</th>
                                <th className="px-3 py-2 text-left font-medium">{tr('Lesson')}</th>
                                <th className="px-3 py-2 text-left font-medium">{tr('Standards')}</th>
                                <th className="px-3 py-2 text-left font-medium">{tr('Assessment')}</th>
                                <th className="px-3 py-2 text-left font-medium">{tr('Resources')}</th>
                                <th className="px-3 py-2 text-left font-medium">{tr('Status')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.lessons.map((lesson) => (
                                <tr key={lesson.id} className="border-b border-[var(--color-border)] last:border-b-0">
                                  <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-[var(--color-text-muted)]">
                                    {lesson.date}
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    <div className="font-medium">{lesson.title}</div>
                                    {lesson.objectives && (
                                      <p className="mt-1 line-clamp-2 max-w-md text-xs text-[var(--color-text-muted)]">
                                        {lesson.objectives}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    <div className="flex max-w-56 flex-wrap gap-1">
                                      {lesson.standardCodes.length ? (
                                        lesson.standardCodes.map((code) => (
                                          <Badge key={code} tone="neutral">
                                            {code}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-[var(--color-text-muted)]">—</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 align-top text-xs">
                                    {lesson.linkedAssessment?.name ?? '—'}
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    {lesson.resources.length ? (
                                      <ul className="space-y-1 text-xs">
                                        {lesson.resources.map((resource) => (
                                          <li key={resource.id} className="flex items-center gap-1.5">
                                            <BookOpen size={12} aria-hidden />
                                            <span>{resource.title}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="text-xs text-[var(--color-text-muted)]">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 align-top">
                                    <Badge tone={lesson.status === 'completed' ? 'success' : 'neutral'}>
                                      {lesson.status === 'completed' ? tr('Completed') : tr('Planned')}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
