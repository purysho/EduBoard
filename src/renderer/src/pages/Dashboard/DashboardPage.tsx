import { Link } from 'react-router-dom'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { StatCard } from '@renderer/components/ui/StatCard'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useClasses, useDashboardStats } from '@renderer/lib/queries'
import { formatDate, formatPercent, formatRate } from '@renderer/lib/format'
import { ClassCard } from '@renderer/pages/Classes/ClassCard'

export function DashboardPage(): React.JSX.Element {
  const { data: stats, isLoading } = useDashboardStats()
  const { data: classes } = useClasses()

  if (isLoading || !stats) return <Spinner />

  return (
    <div>
      <PageHeader title="Dashboard" description="Everything you're teaching, at a glance." />

      <div className="mb-6 grid grid-cols-3 gap-4 md:grid-cols-6">
        <StatCard label="Classes" value={String(stats.classCount)} />
        <StatCard label="Students" value={String(stats.studentCount)} />
        <StatCard label="Active enrollments" value={String(stats.activeEnrollmentCount)} />
        <StatCard label="Overall average" value={formatPercent(stats.averagePercent)} />
        <StatCard label="Pass rate" value={formatRate(stats.passRate)} />
        <StatCard label="Avg. attendance" value={formatRate(stats.averageAttendanceRate)} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Your classes</h2>
          {!classes?.length ? (
            <EmptyState
              title="No classes yet"
              description="Create a class to start tracking students, grades, and lesson plans."
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
              <h2 className="text-sm font-semibold">Upcoming lessons</h2>
              {stats.ungradedAssessmentCount > 0 && (
                <span className="text-xs text-[var(--color-warning)]">
                  {stats.ungradedAssessmentCount} assessment
                  {stats.ungradedAssessmentCount === 1 ? '' : 's'} need grades
                </span>
              )}
            </CardHeader>
            <CardBody>
              {!stats.upcomingLessons.length ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nothing scheduled yet.</p>
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
