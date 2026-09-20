import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarCheck, Download, Play, Plus, QrCode, Square } from 'lucide-react'
import type { AttendanceRecord, ClassSection } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Input } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import {
  queryKeys,
  useAttendanceByClass,
  useAttendanceCheckInStatus,
  useClassroomServerInfo,
  useClassRoster,
  useCloseAttendanceCheckIn,
  useOpenAttendanceCheckIn
} from '@renderer/lib/queries'
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
      <QrCheckInPanel classId={classSection.id} />

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

function QrCheckInPanel({ classId }: { classId: string }): React.JSX.Element {
  const qc = useQueryClient()
  const { data: status } = useAttendanceCheckInStatus(classId, true)
  const isOpen = !!status?.open
  const openCheckIn = useOpenAttendanceCheckIn(classId)
  const closeCheckIn = useCloseAttendanceCheckIn(classId)
  const { data: serverInfo } = useClassroomServerInfo(isOpen)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // The attendance grid's own query has no reason to poll on its own, but a checked-in
  // count that just grew means a student's record landed in the DB via the LAN server,
  // not through any renderer mutation — so the grid's cache needs a nudge to catch up.
  const checkedInCount = status?.checkedInStudentIds.length ?? 0
  const [lastSeenCount, setLastSeenCount] = useState(checkedInCount)
  if (checkedInCount !== lastSeenCount) {
    setLastSeenCount(checkedInCount)
    qc.invalidateQueries({ queryKey: queryKeys.attendanceByClass(classId) })
    qc.invalidateQueries({ queryKey: queryKeys.classRoster(classId) })
  }

  const studentUrl = serverInfo?.url ? `${serverInfo.url}/a/${classId}` : null

  // Fetch the QR code once we have a URL to encode — during render, guarded, rather
  // than an effect, since it's a one-shot derived value keyed to the URL string.
  const [qrForUrl, setQrForUrl] = useState<string | null>(null)
  if (studentUrl && qrForUrl !== studentUrl) {
    setQrForUrl(studentUrl)
    window.api.exitTickets.getQrDataUrl(studentUrl).then(setQrDataUrl)
  } else if (!studentUrl && qrForUrl !== null) {
    setQrForUrl(null)
    setQrDataUrl(null)
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <QrCode size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          QR check-in
        </h2>
        <Button
          variant={isOpen ? 'danger' : 'primary'}
          size="sm"
          onClick={() => (isOpen ? closeCheckIn.mutate() : openCheckIn.mutate(todayIso()))}
          disabled={openCheckIn.isPending || closeCheckIn.isPending}
        >
          {isOpen ? (
            <>
              <Square size={13} className="mr-1 inline" aria-hidden />
              Stop
            </>
          ) : (
            <>
              <Play size={13} className="mr-1 inline" aria-hidden />
              Start
            </>
          )}
        </Button>
      </CardHeader>
      {isOpen && (
        <CardBody className="flex items-start gap-4">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR code for attendance check-in"
              className="h-28 w-28 rounded-lg border border-[var(--color-border)]"
            />
          )}
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Students on this WiFi go to:</p>
            <p className="mt-1 break-all text-lg font-semibold">{studentUrl ?? '…'}</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {status?.checkedInStudentIds.length ?? 0} checked in for {formatDate(todayIso())}
            </p>
            {!serverInfo?.lanIp && (
              <p className="mt-2 text-xs text-[var(--color-warning)]">
                Couldn&apos;t detect a network address — make sure this computer is connected to the
                classroom WiFi (not just powered on).
              </p>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  )
}
