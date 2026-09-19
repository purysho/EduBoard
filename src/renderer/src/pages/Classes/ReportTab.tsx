import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileDown,
  TrendingUp
} from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { StatCard } from '@renderer/components/ui/StatCard'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Avatar } from '@renderer/components/ui/Avatar'
import { Button } from '@renderer/components/ui/Button'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useClassReport, useClassRoster } from '@renderer/lib/queries'
import { formatDate, formatPercent, formatRate, studentFullName } from '@renderer/lib/format'

const LETTER_COLOR: Record<string, string> = {
  A: 'var(--color-success)',
  B: 'var(--color-success)',
  C: 'var(--color-warning)',
  D: 'var(--color-danger)',
  F: 'var(--color-danger)'
}

export function ReportTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: report, isLoading } = useClassReport(classSection.id)
  const { data: roster } = useClassRoster(classSection.id)
  const [exporting, setExporting] = useState(false)

  async function handleExport(): Promise<void> {
    setExporting(true)
    try {
      const path = await window.api.importExport.pickExportPath(
        `${classSection.name.replace(/[^\w -]/g, '')}-gradebook.xlsx`
      )
      if (path) await window.api.importExport.exportGradebook(classSection.id, path)
    } finally {
      setExporting(false)
    }
  }

  async function handlePrint(studentId: string, name: string): Promise<void> {
    await window.api.print.printStudentReport(studentId, classSection.id, `${name} - report.pdf`)
  }

  if (isLoading) return <Spinner />
  if (!report) return <EmptyState icon={BarChart3} title="No report available" />

  const hasData = report.gradeDistribution.some((d) => d.count > 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleExport} disabled={exporting}>
          <Download size={15} className="mr-1 inline" aria-hidden />
          {exporting ? 'Exporting…' : 'Export gradebook (.xlsx)'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Class average"
          value={formatPercent(report.averagePercent)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Pass rate"
          value={formatRate(report.passRate)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Average attendance"
          value={formatRate(report.averageAttendanceRate)}
          icon={CalendarCheck}
          tone="warning"
        />
      </div>

      {!hasData ? (
        <EmptyState
          title="Not enough data yet"
          description="Enter some grades to see charts here."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Grade distribution</h2>
            </CardHeader>
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.gradeDistribution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis dataKey="letter" stroke="var(--color-text-muted)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--color-text-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {report.gradeDistribution.map((entry) => (
                      <Cell
                        key={entry.letter}
                        fill={LETTER_COLOR[entry.letter] ?? 'var(--color-primary)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Category averages</h2>
            </CardHeader>
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.categoryAverages} layout="vertical" margin={{ left: 16 }}>
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
                    width={90}
                    stroke="var(--color-text-muted)"
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  />
                  <Bar dataKey="averagePercent" radius={[0, 4, 4, 0]} fill="var(--color-primary)" />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {report.attendanceTrend.length > 1 && (
            <Card className="col-span-2">
              <CardHeader>
                <h2 className="text-sm font-semibold">Attendance trend</h2>
              </CardHeader>
              <CardBody className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={report.attendanceTrend.map((t) => ({
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
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 12
                      }}
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
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Student report cards</h2>
        </CardHeader>
        <CardBody className="space-y-2">
          {!roster?.length ? (
            <p className="text-sm text-[var(--color-text-muted)]">No students enrolled.</p>
          ) : (
            roster.map((row) => (
              <div key={row.student.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2.5">
                  <Avatar name={studentFullName(row.student)} size="sm" />
                  {studentFullName(row.student)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePrint(row.student.id, studentFullName(row.student))}
                >
                  <FileDown size={14} className="mr-1 inline" aria-hidden />
                  Print PDF
                </Button>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  )
}
