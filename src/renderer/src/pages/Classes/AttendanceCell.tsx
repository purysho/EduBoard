import type { AttendanceRecord, AttendanceStatus } from '@shared/types'
import { useMarkAttendance } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/cn'

const CYCLE: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

const STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  late: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  absent: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  excused: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
}

const LETTER: Record<AttendanceStatus, string> = {
  present: 'P',
  late: 'L',
  absent: 'A',
  excused: 'E'
}

export function AttendanceCell({
  classId,
  studentId,
  date,
  record
}: {
  classId: string
  studentId: string
  date: string
  record: AttendanceRecord | undefined
}): React.JSX.Element {
  const markAttendance = useMarkAttendance(classId)

  function handleClick(): void {
    const currentIndex = record ? CYCLE.indexOf(record.status) : -1
    const next = CYCLE[(currentIndex + 1) % CYCLE.length]
    markAttendance.mutate({ classId, studentId, date, status: next })
  }

  return (
    <button
      onClick={handleClick}
      title={record ? record.status : 'Not marked — click to mark present'}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-xs font-semibold transition-colors',
        record
          ? STYLES[record.status]
          : 'bg-[var(--color-surface-muted)] text-[var(--color-border)]'
      )}
    >
      {record ? LETTER[record.status] : '·'}
    </button>
  )
}
