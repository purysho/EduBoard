import { useState } from 'react'
import { Layers } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Field'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { letterTone } from '@renderer/lib/grade'
import { formatPercent } from '@renderer/lib/format'
import { useCourseGroupComposite, useCourseGroups } from '@renderer/lib/queries'

export function CompositeGradesPage(): React.JSX.Element {
  const { data: courseGroups, isLoading: loadingGroups } = useCourseGroups()
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const { data: composites, isLoading: loadingComposites } = useCourseGroupComposite(
    selectedGroupId || undefined
  )

  const selectedGroup = (courseGroups ?? []).find((g) => g.id === selectedGroupId)

  return (
    <div>
      <PageHeader
        title="Composite Grades"
        description="A student's combined grade across a course's terms — link classes to a course group from each class's Settings tab."
      />

      {loadingGroups ? (
        <Spinner />
      ) : !courseGroups?.length ? (
        <EmptyState
          icon={Layers}
          title="No course groups yet"
          description="From a class's Settings tab, set its course group to link it with the same course's other terms."
        />
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <Select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              <option value="">Select a course…</option>
              {courseGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>

          {!selectedGroupId ? null : loadingComposites ? (
            <Spinner />
          ) : !composites?.length ? (
            <EmptyState
              icon={Layers}
              title="No students yet"
              description={`No class in "${selectedGroup?.name ?? 'this course'}" has any students enrolled.`}
            />
          ) : (
            <div className="overflow-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Student</th>
                    {composites[0].classes.map((c) => (
                      <th key={c.classId} className="px-3 py-2.5 text-center font-medium">
                        {c.termName ?? c.className}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-medium">Composite</th>
                  </tr>
                </thead>
                <tbody>
                  {composites.map((row) => (
                    <tr key={row.studentId} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-2 font-medium">{row.studentName}</td>
                      {row.classes.map((c) => (
                        <td key={c.classId} className="px-3 py-2 text-center">
                          {formatPercent(c.percent)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{formatPercent(row.compositePercent)}</span>
                          {row.compositeLetter && (
                            <Badge tone={letterTone(row.compositeLetter)}>
                              {row.compositeLetter}
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedGroup && (
        <Card className="mt-4">
          <CardBody className="text-xs text-[var(--color-text-muted)]">
            Composite is a weighted average of each term&apos;s grade (weight set per class in its
            Settings tab), renormalized across whichever terms have a grade so far.
          </CardBody>
        </Card>
      )}
    </div>
  )
}
