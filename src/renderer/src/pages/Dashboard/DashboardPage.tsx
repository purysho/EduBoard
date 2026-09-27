import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  TrendingUp,
  Users
} from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { StatCard } from '@renderer/components/ui/StatCard'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { Button } from '@renderer/components/ui/Button'
import { useClasses, useDashboardStats } from '@renderer/lib/queries'
import { formatDate, formatPercent, formatRate } from '@renderer/lib/format'
import { ClassCard } from '@renderer/pages/Classes/ClassCard'
import { GettingStarted } from './GettingStarted'
import { BackupReminder } from './BackupReminder'
import { ResetRequests } from './ResetRequests'
import { UnpublishedNotice } from './UnpublishedNotice'
import { AttendanceWarnings } from './AttendanceWarnings'
import { TodayCard, WatchListCard } from './TodayCards'
import { tr } from '@shared/i18n'

export function DashboardPage(): React.JSX.Element {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: classes } = useClasses()

  if (isLoading || !stats) return <Spinner />

  return (
    <div>
      <PageHeader
        title={tr('Dashboard')}
        description={tr("Everything you're teaching, at a glance.")}
        actions={
          <Link
            to="/weekly-summary"
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-muted)]"
          >
            {tr('Your week')}
          </Link>
        }
      />

      <ResetRequests />
      <UnpublishedNotice />
      <GettingStarted />
      <BackupReminder hasData={stats.classCount > 0} />
      <TodayCard />
      <AttendanceWarnings />
      <WatchListCard />

      <div className="mb-6 grid grid-cols-3 gap-4 md:grid-cols-6">
        <StatCard label={tr('Classes')} value={String(stats.classCount)} icon={GraduationCap} />
        <StatCard
          label={tr('Students')}
          value={String(stats.studentCount)}
          icon={Users}
          tone="neutral"
        />
        <StatCard
          label={tr('Active enrollments')}
          value={String(stats.activeEnrollmentCount)}
          icon={ClipboardCheck}
          tone="neutral"
        />
        <StatCard
          label={tr('Overall average')}
          value={formatPercent(stats.averagePercent)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label={tr('Pass rate')}
          value={formatRate(stats.passRate)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label={tr('Avg. attendance')}
          value={formatRate(stats.averageAttendanceRate)}
          icon={CalendarClock}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
            {tr('Your classes')}
          </h2>
          {!classes?.length ? (
            <EmptyState
              icon={GraduationCap}
              title={tr('No classes yet')}
              description={tr(
                'Create a class to start tracking students, grades, and lesson plans.'
              )}
              action={
                <Link to="/classes">
                  <Button variant="primary">{tr('+ New class')}</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {classes.slice(0, 6).map((c) => (
                <ClassCard key={c.id} classSection={c} />
              ))}
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock size={16} className="text-[var(--color-text-muted)]" aria-hidden />
                {tr('Upcoming lessons')}
              </h2>
              {stats.ungradedAssessmentCount > 0 && (
                <span className="rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
                  {tr('{ungradedAssessmentCount} need grades', {
                    ungradedAssessmentCount: stats.ungradedAssessmentCount
                  })}
                </span>
              )}
            </CardHeader>
            <CardBody>
              {!stats.upcomingLessons.length ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {tr('Nothing scheduled yet.')}
                </p>
              ) : (
                <ul className="space-y-3">
                  {stats.upcomingLessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        to={`/classes/${lesson.classId}/lessons`}
                        className="block text-sm hover:text-[var(--color-primary)]"
                      >
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatDate(lesson.date)}
                        </span>
                        <p className="font-medium">{lesson.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
