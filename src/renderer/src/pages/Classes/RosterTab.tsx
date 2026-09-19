import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { ClassSection } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { letterTone } from '@renderer/lib/grade'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useClassRoster, useUnenrollStudent } from '@renderer/lib/queries'
import { formatPercent, formatRate, studentFullName } from '@renderer/lib/format'
import { EnrollStudentModal } from './EnrollStudentModal'

export function RosterTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: roster, isLoading } = useClassRoster(classSection.id)
  const unenroll = useUnenrollStudent(classSection.id)
  const [showEnroll, setShowEnroll] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null)

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setShowEnroll(true)}>
          + Enroll students
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !roster?.length ? (
        <EmptyState
          title="No students enrolled yet"
          description="Enroll existing students or add new ones to this class."
          action={
            <Button variant="primary" onClick={() => setShowEnroll(true)}>
              + Enroll students
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Grade</th>
                <th className="px-4 py-2.5 font-medium">Letter</th>
                <th className="px-4 py-2.5 font-medium">Attendance</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => (
                <tr
                  key={row.student.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/students/${row.student.id}`}
                      className="font-medium hover:text-[var(--color-primary)]"
                    >
                      {studentFullName(row.student)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.enrollment.status === 'active' ? (
                      <Badge tone="primary">Active</Badge>
                    ) : (
                      <Badge>{row.enrollment.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{formatPercent(row.grade.percent)}</td>
                  <td className="px-4 py-2.5">
                    {row.grade.letter ? (
                      <Badge tone={letterTone(row.grade.letter)}>{row.grade.letter}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {formatRate(row.attendanceRate)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPendingRemove({ id: row.student.id, name: studentFullName(row.student) })
                      }
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EnrollStudentModal
        open={showEnroll}
        onClose={() => setShowEnroll(false)}
        classId={classSection.id}
      />

      <ConfirmDialog
        open={!!pendingRemove}
        title="Remove from class"
        message={`Remove ${pendingRemove?.name} from ${classSection.name}? Their scores and attendance in this class will be deleted. The student record itself is kept.`}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (pendingRemove) await unenroll.mutateAsync(pendingRemove.id)
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}
