import { Link } from 'react-router-dom'
import type { ClassSection, Enrollment } from '@shared/types'
import { Badge } from '@renderer/components/ui/Badge'
import { letterTone } from '@renderer/lib/grade'
import { formatPercent, formatRate } from '@renderer/lib/format'
import { useStudentAttendanceSummary, useStudentClassGrade } from '@renderer/lib/queries'

export function StudentClassRow({
  studentId,
  cls,
  enrollment
}: {
  studentId: string
  cls: ClassSection
  enrollment: Enrollment
}): React.JSX.Element {
  const { data: grade } = useStudentClassGrade(studentId, cls.id)
  const { data: attendance } = useStudentAttendanceSummary(studentId, cls.id)

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-4 py-2.5">
        <Link to={`/classes/${cls.id}`} className="font-medium hover:text-[var(--color-primary)]">
          {cls.name}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
        {enrollment.status === 'active' ? (
          <Badge tone="primary">Active</Badge>
        ) : (
          <Badge>{enrollment.status}</Badge>
        )}
      </td>
      <td className="px-4 py-2.5">{formatPercent(grade?.percent)}</td>
      <td className="px-4 py-2.5">
        {grade?.letter ? <Badge tone={letterTone(grade.letter)}>{grade.letter}</Badge> : '—'}
      </td>
      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatRate(attendance?.rate)}</td>
    </tr>
  )
}
