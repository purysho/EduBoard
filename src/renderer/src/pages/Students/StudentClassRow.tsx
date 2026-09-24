import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ClassSection, Enrollment, GradeTrendDirection, GradeTrendPoint } from '@shared/types'
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
  useStudentGradeTrend,
  useStudentLogEntries,
  useStudents
} from '@renderer/lib/queries'

// A flat 8-point swing from the first to the most recent scored assessment is treated
// as a real trend rather than noise — small enough to catch a student sliding before a
// report card would otherwise flag it, large enough not to fire on normal week-to-week
// variation. Needs at least 3 points so a two-assessment blip can't trigger it.
const TREND_THRESHOLD_POINTS = 8

function classifyTrend(
  trend: GradeTrendPoint[] | undefined
): { direction: GradeTrendDirection; deltaPoints: number } | null {
  if (!trend || trend.length < 3) return null
  const delta = trend[trend.length - 1].percent - trend[0].percent
  if (delta >= TREND_THRESHOLD_POINTS) return { direction: 'improving', deltaPoints: delta }
  if (delta <= -TREND_THRESHOLD_POINTS) return { direction: 'declining', deltaPoints: delta }
  return { direction: 'steady', deltaPoints: delta }
}

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
  const { data: trend } = useStudentGradeTrend(studentId, cls.id)
  const trendInfo = classifyTrend(trend)

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
        {trend && trend.length >= 2 ? (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <Tooltip
                  formatter={(value: number, _name, entry) => [
                    `${value.toFixed(0)}%`,
                    entry.payload.assessmentName
                  ]}
                  contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke="var(--color-primary)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">Not enough data</span>
        )}
        {trendInfo && trendInfo.direction !== 'steady' && (
          <Badge tone={trendInfo.direction === 'declining' ? 'danger' : 'success'} className="ml-2">
            {trendInfo.direction === 'declining' ? 'Declining' : 'Improving'}
          </Badge>
        )}
      </td>
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
          trendDirection={trendInfo?.direction ?? null}
          trendDeltaPoints={trendInfo?.deltaPoints ?? null}
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
  attendanceRate,
  trendDirection,
  trendDeltaPoints
}: {
  studentId: string
  className: string
  percent: number | null
  letter: string | null
  attendanceRate: number | null
  trendDirection: GradeTrendDirection | null
  trendDeltaPoints: number | null
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
      recentNotes: (logEntries ?? []).slice(0, 5).map((e) => e.text),
      trendDirection,
      trendDeltaPoints
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
