import { Link } from 'react-router-dom'
import { UserX } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { useAttendanceWarnings } from '@renderer/lib/queries'

/** Students under their class's minimum attendance (set in each class's Settings). */
export function AttendanceWarnings(): React.JSX.Element | null {
  const { data: warnings } = useAttendanceWarnings()
  if (!warnings?.length) return null
  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <UserX size={15} className="text-[var(--color-danger)]" aria-hidden />
          Below the attendance requirement
        </h2>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="divide-y divide-[var(--color-border)] text-sm">
          {warnings.map((w) => (
            <li
              key={`${w.classId}-${w.studentId}`}
              className="flex flex-wrap items-center gap-3 px-4 py-2"
            >
              <Link
                to={`/students/${w.studentId}`}
                className="min-w-0 flex-1 font-medium hover:text-[var(--color-primary)]"
              >
                {w.studentName}
              </Link>
              <Link
                to={`/classes/${w.classId}/attendance`}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                {w.className}
              </Link>
              <span className="w-40 text-right">
                <strong className="text-[var(--color-danger)]">{Math.round(w.rate * 100)}%</strong>{' '}
                <span className="text-[var(--color-text-muted)]">
                  of {w.sessions} (needs {w.minAttendance}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
