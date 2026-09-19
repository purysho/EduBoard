import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarCheck, Download, Plus } from 'lucide-react'
import type { AttendanceRecord, ClassSection } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useAttendanceByClass, useClassRoster } from '@renderer/lib/queries'
import { formatDate, formatRate, studentFullName, todayIso } from '@renderer/lib/format'
import { AttendanceCell } from './AttendanceCell'

export function AttendanceTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: roster, isLoading: rosterLoading } = useClassRoster(classSection.id)
  const { data: records } = useAttendanceByClass(classSection.id)
  const [extraDates, setExtraDates] = useState<string[]>([todayIso()])
  const [newDate, setNewDate] = useState('')
  const [exporting, setExporting] = useState(false)

  async function handleExportCsv(): Promise<void> {
    setExporting(true)
    try {
      const path = await window.api.importExport.pickExportPath(
        `${classSection.name.replace(/[^\w -]/g, '')}-attendance.csv`
      )
      if (path) await window.api.importExport.exportAttendance(classSection.id, path)
    } finally {
      setExporting(false)
    }
  }

  const dates = useMemo(() => {
    const set = new Set(extraDates)
    for (const r of records ?? []) set.add(r.date)
    return Array.from(set).sort()
  }, [records, extraDates])

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()
    for (const r of records ?? []) map.set(`${r.studentId}:${r.date}`, r)
    return map
  }, [records])

  function addDate(): void {
    if (newDate && !dates.includes(newDate)) {
      setExtraDates((prev) => [...prev, newDate])
    }
    setNewDate('')
  }

  if (rosterLoading) return <Spinner />
  if (!roster?.length) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No students enrolled"
        description="Enroll students from the Roster tab first."
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          Click a cell to cycle Present → Late → Absent → Excused.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-40"
          />
          <Button variant="secondary" onClick={addDate}>
            <Plus size={15} className="mr-1 inline" aria-hidden />
            Add date
          </Button>
          <Button variant="secondary" onClick={handleExportCsv} disabled={exporting}>
            <Download size={15} className="mr-1 inline" aria-hidden />
            {exporting ? 'Exporting…' : 'Export .csv'}
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--color-border)]">
        <table className="text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-left font-medium">
                Student
              </th>
              {dates.map((date) => (
                <th key={date} className="px-1.5 py-2 text-center font-medium">
                  {formatDate(date, 'MMM d')}
                </th>
              ))}
              <th className="min-w-20 px-3 py-2 text-center font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((row) => (
              <tr key={row.student.id} className="border-t border-[var(--color-border)]">
                <td className="sticky left-0 z-10 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 font-medium">
                  <Link
                    to={`/students/${row.student.id}`}
                    className="hover:text-[var(--color-primary)]"
                  >
                    {studentFullName(row.student)}
                  </Link>
                </td>
                {dates.map((date) => (
                  <td key={date} className="px-1.5 py-1 text-center">
                    <AttendanceCell
                      classId={classSection.id}
                      studentId={row.student.id}
                      date={date}
                      record={recordMap.get(`${row.student.id}:${date}`)}
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center text-[var(--color-text-muted)]">
                  {formatRate(row.attendanceRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
