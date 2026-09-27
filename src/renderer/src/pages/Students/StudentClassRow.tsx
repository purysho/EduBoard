import { Link } from 'react-router-dom'
import { MessageSquareText } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ClassSection, Enrollment } from '@shared/types'
import { Badge } from '@renderer/components/ui/Badge'
import { letterTone } from '@renderer/lib/grade'
import { classifyTrend } from '@renderer/lib/trend'
import { formatPercent, formatRate } from '@renderer/lib/format'
import {
  useStudentAttendanceSummary,
  useStudentClassGrade,
  useStudentGradeTrend
} from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

// A flat 8-point swing from the first to the most recent scored assessment is treated
// as a real trend rather than noise — small enough to catch a student sliding before a
// report card would otherwise flag it, large enough not to fire on normal week-to-week
// variation. Needs at least 3 points so a two-assessment blip can't trigger it.
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
          <Badge tone="primary">{tr('Active')}</Badge>
        ) : (
          <Badge>{tr(enrollment.status)}</Badge>
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
          <span className="text-xs text-[var(--color-text-muted)]">{tr('Not enough data')}</span>
        )}
        {trendInfo && trendInfo.direction !== 'steady' && (
          <Badge tone={trendInfo.direction === 'declining' ? 'danger' : 'success'} className="ml-2">
            {trendInfo.direction === 'declining' ? tr('Declining') : tr('Improving')}
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5">
        {grade?.letter ? (
          <Badge tone={letterTone(grade.letter, cls.gradeThresholds)}>{grade.letter}</Badge>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatRate(attendance?.rate)}</td>
      <td className="px-4 py-2.5">
        <Link
          to={`/classes/${cls.id}/report?student=${studentId}#comments`}
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          <MessageSquareText size={13} aria-hidden />
          {tr('Report comment')}
        </Link>
      </td>
    </tr>
  )
}
