import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { CalendarCheck, Download, Play, Plus, QrCode, Square } from 'lucide-react'
import type { AttendanceRecord, ClassSection } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { DateSelect } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  queryKeys,
  useAttendanceByClass,
  useAttendanceCheckInStatus,
  useClassroomServerInfo,
  useClassRoster,
  useCloseAttendanceCheckIn,
  useMarkAttendance,
  useMarkAttendanceBulk,
  useOpenAttendanceCheckIn,
  useSettings
} from '@renderer/lib/queries'
import { resolveAttendanceCodes } from '@shared/attendanceCodes'
import { formatDate, formatRate, studentFullName, todayIso } from '@renderer/lib/format'
import { AttendanceCell } from './AttendanceCell'
import { tr } from '@shared/i18n'

const RECENT_DAYS = 15

export function AttendanceTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: roster, isLoading: rosterLoading } = useClassRoster(classSection.id)
  const { data: records } = useAttendanceByClass(classSection.id)
  const [extraDates, setExtraDates] = useState<string[]>([todayIso()])
  const [newDate, setNewDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const [pendingMarkAllDate, setPendingMarkAllDate] = useState<string | null>(null)
  const markBulk = useMarkAttendanceBulk(classSection.id)
  const markAttendance = useMarkAttendance(classSection.id)
  const { data: settings } = useSettings()
  const codes = useMemo(
    () => resolveAttendanceCodes(settings?.attendanceCodes),
    [settings?.attendanceCodes]
  )
  const offered = useMemo(() => codes.filter((c) => !c.hidden), [codes])
  const [showAllDates, setShowAllDates] = useState(false)

  function handleMarkAllPresent(date: string): void {
    markBulk.mutate(
      (roster ?? []).map((row) => ({
        classId: classSection.id,
        studentId: row.student.id,
        date,
        status: 'present' as const
      }))
    )
    setPendingMarkAllDate(null)
  }

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

  // A term has a hundred or more school days: the register opens on the most recent ones
  // (today and any date just added included), not the first day of term far off to the left.
  const shownDates = useMemo(
    () =>
      showAllDates
        ? dates
        : dates.filter((d, i) => i >= dates.length - RECENT_DAYS || extraDates.includes(d)),
    [dates, extraDates, showAllDates]
  )

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
        title={tr('No students enrolled')}
        description={tr('Enroll students from the Roster tab first.')}
        action={
          <Link to={`/classes/${classSection.id}`}>
            <Button size="sm">{tr('Open the roster')}</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <QrCheckInPanel classId={classSection.id} />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'Click a cell to step through the codes (Present → Late → Absent → Excused, then your own). Right-click to pick any code or add a note.'
          )}
        </p>
        <div className="flex items-center gap-2">
          <div className="w-80">
            <DateSelect value={newDate} onChange={setNewDate} />
          </div>
          <Button variant="secondary" onClick={addDate}>
            <Plus size={15} className="mr-1 inline" aria-hidden />
            {tr('Add date')}
          </Button>
          <Button variant="secondary" onClick={handleExportCsv} disabled={exporting}>
            <Download size={15} className="mr-1 inline" aria-hidden />
            {exporting ? tr('Exporting…') : tr('Export .csv')}
          </Button>
        </div>
      </div>

      {dates.length > RECENT_DAYS && (
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          {showAllDates
            ? tr('Showing all {n} days.', { n: dates.length })
            : tr('Showing the last {shown} of {n} days.', {
                shown: shownDates.length,
                n: dates.length
              })}{' '}
          <button
            type="button"
            className="font-medium text-[var(--color-primary)] hover:underline"
            onClick={() => setShowAllDates((v) => !v)}
          >
            {showAllDates ? tr('Show recent days only') : tr('Show all days')}
          </button>
        </p>
      )}
      <div className="overflow-auto rounded-xl border border-[var(--color-border)]">
        <table className="text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-muted)]">
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-left font-medium">
                {tr('Student')}
              </th>
              {shownDates.map((date) => (
                <th key={date} className="px-1.5 py-2 text-center font-medium">
                  <button
                    onClick={() => setPendingMarkAllDate(date)}
                    className="hover:text-[var(--color-primary)]"
                    title={tr('Mark everyone present for this date')}
                  >
                    {formatDate(date, 'MMM d')}
                  </button>
                </th>
              ))}
              <th className="min-w-20 px-3 py-2 text-center font-medium">{tr('Rate')}</th>
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
                {shownDates.map((date) => (
                  <td key={date} className="px-1.5 py-1 text-center">
                    <AttendanceCell
                      classId={classSection.id}
                      studentId={row.student.id}
                      date={date}
                      record={recordMap.get(`${row.student.id}:${date}`)}
                      codes={codes}
                      offered={offered}
                      mark={markAttendance.mutateAsync}
                    />
                  </td>
                ))}
                <td data-private className="px-3 py-1.5 text-center text-[var(--color-text-muted)]">
                  {formatRate(row.attendanceRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingMarkAllDate}
        title={tr('Mark everyone present')}
        message={tr(
          'Mark every enrolled student present on {date}? This overwrites any statuses already set for that date.',
          { date: pendingMarkAllDate ? formatDate(pendingMarkAllDate, 'MMM d') : '' }
        )}
        confirmLabel={tr('Mark all present')}
        onConfirm={() => pendingMarkAllDate && handleMarkAllPresent(pendingMarkAllDate)}
        onCancel={() => setPendingMarkAllDate(null)}
      />
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
          {tr('QR check-in')}
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
              {tr('Stop')}
            </>
          ) : (
            <>
              <Play size={13} className="mr-1 inline" aria-hidden />
              {tr('Start')}
            </>
          )}
        </Button>
      </CardHeader>
      {isOpen && (
        <CardBody className="flex items-start gap-4">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt={tr('QR code for attendance check-in')}
              className="h-28 w-28 rounded-lg border border-[var(--color-border)]"
            />
          )}
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {tr('Students on this WiFi go to:')}
            </p>
            <p className="mt-1 break-all text-lg font-semibold">{studentUrl ?? '…'}</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {status?.checkedInStudentIds.length ?? 0}{' '}
              {tr('checked in for {date}', { date: formatDate(todayIso()) })}
            </p>
            {!serverInfo?.lanIp && (
              <p className="mt-2 text-xs text-[var(--color-warning)]">
                {tr(
                  "Couldn't detect a network address — make sure this computer is connected to the classroom WiFi (not just powered on)."
                )}
              </p>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  )
}
