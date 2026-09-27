import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AttendanceRecord, AttendanceStatus } from '@shared/types'
import { resolveAttendanceCodes, type AttendanceCode } from '@shared/attendanceCodes'
import { useMarkAttendance, useSettings } from '@renderer/lib/queries'
import { Button } from '@renderer/components/ui/Button'
import { cn } from '@renderer/lib/cn'
import { tr } from '@shared/i18n'

// Colour by what a code counts as, so the school's own codes read at a glance.
const STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  late: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  absent: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  excused: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
}

/** One day's attendance for one student. Click steps through the codes in use; right-
 * click picks any code and adds a note. */
export function AttendanceCell({
  classId,
  studentId,
  date,
  record
}: {
  classId: string
  studentId: string
  date: string
  record: AttendanceRecord | undefined
}): React.JSX.Element {
  const markAttendance = useMarkAttendance(classId)
  const { data: settings } = useSettings()
  const codes = resolveAttendanceCodes(settings?.attendanceCodes)
  const offered = codes.filter((c) => !c.hidden)
  const code: AttendanceCode | undefined = record
    ? codes.find((c) => c.id === record.status)
    : undefined
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)
  const [pick, setPick] = useState<string>('present')
  const [note, setNote] = useState('')

  function handleClick(): void {
    const currentIndex = record ? offered.findIndex((c) => c.id === record.status) : -1
    const next = offered[(currentIndex + 1) % offered.length]
    markAttendance.mutate({ classId, studentId, date, status: next.id, note: record?.note ?? null })
  }

  function openMenu(e: React.MouseEvent): void {
    e.preventDefault()
    const rect = anchorRef.current!.getBoundingClientRect()
    setMenu({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 272) })
    setPick(record?.status ?? 'present')
    setNote(record?.note ?? '')
  }

  const title = record
    ? [code?.label ?? record.status, record.note].filter(Boolean).join(' — ')
    : tr('Not marked — click to mark present')

  return (
    <>
      <button
        ref={anchorRef}
        onClick={handleClick}
        onContextMenu={openMenu}
        title={title}
        className={cn(
          'relative flex h-7 w-7 items-center justify-center rounded text-xs font-semibold transition-colors',
          record
            ? STYLES[code?.countsAs ?? 'excused']
            : 'bg-[var(--color-surface-muted)] text-[var(--color-border)]'
        )}
      >
        {record ? (code?.letter ?? '?') : '·'}
        {record?.note && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
          />
        )}
      </button>
      {menu &&
        createPortal(
          <div
            role="dialog"
            aria-label={tr('Attendance')}
            className="fixed z-50 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-lg"
            style={{ top: menu.top, left: menu.left }}
          >
            <p className="mb-1.5 text-xs font-semibold">{tr('Attendance')}</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {codes
                .filter((c) => !c.hidden || c.id === record?.status)
                .map((c) => (
                  <button
                    key={c.id}
                    aria-pressed={pick === c.id}
                    onClick={() => setPick(c.id)}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs',
                      pick === c.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                        : 'border-[var(--color-border)]'
                    )}
                  >
                    {c.label}
                  </button>
                ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={tr('Note (optional), e.g. left early for a doctor’s appointment')}
              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-primary)]"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setMenu(null)}>
                {tr('Cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  await markAttendance.mutateAsync({
                    classId,
                    studentId,
                    date,
                    status: pick,
                    note: note.trim() || null
                  })
                  setMenu(null)
                }}
              >
                {tr('Save')}
              </Button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
