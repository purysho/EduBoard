import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Avatar } from '@renderer/components/ui/Avatar'
import { letterTone } from '@renderer/lib/grade'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useClassRoster, useUnenrollStudent } from '@renderer/lib/queries'
import { formatPercent, formatRate, studentFullName } from '@renderer/lib/format'
import { EnrollStudentModal } from './EnrollStudentModal'
import { ImportPanel } from '../Settings/ImportPanel'
import { tr } from '@shared/i18n'

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
          <UserPlus size={15} className="mr-1 inline" aria-hidden />
          {tr('Enroll students')}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !roster?.length ? (
        <EmptyState
          icon={Users}
          title={tr('No students enrolled yet')}
          description={tr(
            'Add students one by one, or import your class list from a spreadsheet below.'
          )}
          action={
            <Button variant="primary" onClick={() => setShowEnroll(true)}>
              <UserPlus size={15} className="mr-1 inline" aria-hidden />
              {tr('Enroll students')}
            </Button>
          }
        />
      ) : null}
      {/* A class list usually already exists in a spreadsheet: import it straight into
          this class. */}
      {!isLoading && !roster?.length && (
        <div className="mt-4">
          <ImportPanel fixedClassId={classSection.id} />
        </div>
      )}
      {isLoading || !roster?.length ? null : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">{tr('Name')}</th>
                <th className="px-4 py-2.5 font-medium">{tr('Status')}</th>
                <th className="px-4 py-2.5 font-medium">{tr('Grade')}</th>
                <th className="px-4 py-2.5 font-medium">{tr('Letter')}</th>
                <th className="px-4 py-2.5 font-medium">{tr('Attendance')}</th>
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
                      className="flex items-center gap-2.5 font-medium hover:text-[var(--color-primary)]"
                    >
                      <Avatar name={studentFullName(row.student)} size="sm" />
                      {studentFullName(row.student)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.enrollment.status === 'active' ? (
                      <Badge tone="primary">{tr('Active')}</Badge>
                    ) : (
                      <Badge>{tr(row.enrollment.status)}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{formatPercent(row.grade.percent)}</td>
                  <td className="px-4 py-2.5">
                    {row.grade.letter ? (
                      <Badge tone={letterTone(row.grade.letter, classSection.gradeThresholds)}>
                        {row.grade.letter}
                      </Badge>
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
                      {tr('Remove')}
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
        title={tr('Remove from class')}
        message={tr(
          'Remove {name} from {name2}? Their scores and attendance in this class will be deleted. The student record itself is kept.',
          { name: pendingRemove?.name, name2: classSection.name }
        )}
        confirmLabel={tr('Remove')}
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
