import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useAnalyticsOverview } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

const chartTooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12
}

export function AnalyticsPage(): React.JSX.Element {
  const { data: overview, isLoading } = useAnalyticsOverview()

  if (isLoading) return <Spinner />

  const hasClasses = !!overview?.classComparison.length

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Grades and attendance compared across every active class."
      />

      {!hasClasses ? (
        <EmptyState
          icon={BarChart3}
          title="Not enough data yet"
          description="Add classes, enroll students, and enter some grades to see analytics here."
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Class comparison</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Average grade, pass rate, and attendance rate side by side.
              </p>
            </CardHeader>
            <CardBody className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overview.classComparison.map((c) => ({
                    className: c.className,
                    Average: c.averagePercent === null ? null : Math.round(c.averagePercent),
                    'Pass rate': c.passRate === null ? null : Math.round(c.passRate * 100),
                    Attendance:
                      c.averageAttendanceRate === null
                        ? null
                        : Math.round(c.averageAttendanceRate * 100)
                  }))}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis dataKey="className" stroke="var(--color-text-muted)" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="var(--color-text-muted)" fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => `${value}%`}
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar dataKey="Average" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pass rate" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Attendance" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {!overview.categoryComparison.length ? null : (
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold">Category performance, school-wide</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Averaged across every class that has a category of that name.
                  </p>
                </CardHeader>
                <CardBody className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={overview.categoryComparison}
                      layout="vertical"
                      margin={{ left: 16 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        stroke="var(--color-text-muted)"
                        fontSize={12}
                      />
                      <YAxis
                        type="category"
                        dataKey="categoryName"
                        width={100}
                        stroke="var(--color-text-muted)"
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number, _name, entry) => [
                          `${value.toFixed(1)}%`,
                          `${entry.payload.classCount} class${entry.payload.classCount === 1 ? '' : 'es'}`
                        ]}
                        contentStyle={chartTooltipStyle}
                      />
                      <Bar
                        dataKey="averagePercent"
                        radius={[0, 4, 4, 0]}
                        fill="var(--color-primary)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            )}

            {overview.attendanceTrend.length <= 1 ? null : (
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold">Attendance trend, school-wide</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Every class&apos;s attendance rate, averaged per day.
                  </p>
                </CardHeader>
                <CardBody className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={overview.attendanceTrend.map((t) => ({
                        ...t,
                        ratePercent: (t.rate ?? 0) * 100
                      }))}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => formatDate(d, 'MMM d')}
                        stroke="var(--color-text-muted)"
                        fontSize={12}
                      />
                      <YAxis domain={[0, 100]} stroke="var(--color-text-muted)" fontSize={12} />
                      <Tooltip
                        labelFormatter={(d) => formatDate(d as string)}
                        formatter={(value: number) => [`${value.toFixed(0)}%`, 'Attendance']}
                        contentStyle={chartTooltipStyle}
                      />
                      <Line
                        type="monotone"
                        dataKey="ratePercent"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
