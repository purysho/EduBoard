import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import type { ClassSection, Enrollment } from '@shared/types'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { letterTone } from '@renderer/lib/grade'
import { formatPercent, formatRate, ipcErrorMessage, studentFullName } from '@renderer/lib/format'
import {
  useDraftReportComment,
  useStudentAttendanceSummary,
  useStudentClassGrade,
  useStudentLogEntries,
  useStudents
} from '@renderer/lib/queries'

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
      <td className="px-4 py-2.5">
        <DraftCommentButton
          studentId={studentId}
          className={cls.name}
          percent={grade?.percent ?? null}
          letter={grade?.letter ?? null}
          attendanceRate={attendance?.rate ?? null}
        />
      </td>
    </tr>
  )
}

function DraftCommentButton({
  studentId,
  className,
  percent,
  letter,
  attendanceRate
}: {
  studentId: string
  className: string
  percent: number | null
  letter: string | null
  attendanceRate: number | null
}): React.JSX.Element {
  const { data: students } = useStudents(true)
  const { data: logEntries } = useStudentLogEntries(studentId)
  const draftComment = useDraftReportComment()
  const [open, setOpen] = useState(false)

  const studentName = studentFullName(
    students?.find((s) => s.id === studentId) ?? { firstName: '', lastName: '' }
  )

  async function handleDraft(): Promise<void> {
    setOpen(true)
    await draftComment.mutateAsync({
      studentName,
      className,
      percent,
      letter,
      attendanceRate,
      recentNotes: (logEntries ?? []).slice(0, 5).map((e) => e.text)
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleDraft}>
        <Sparkles size={13} className="mr-1 inline" aria-hidden />
        Draft comment
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Report comment — ${className}`}>
        {draftComment.isPending ? (
          <Spinner />
        ) : draftComment.isError ? (
          <p className="text-sm text-[var(--color-danger)]">
            {ipcErrorMessage(draftComment.error, 'Could not draft a comment.')}
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{draftComment.data}</p>
        )}
      </Modal>
    </>
  )
}
