import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LayoutGrid, RotateCcw } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { cn } from '@renderer/lib/cn'
import { studentFullName } from '@renderer/lib/format'
import {
  useAssignSeat,
  useClassRoster,
  useClearSeatingChart,
  useSeatAssignments,
  useUnassignSeat,
  useUpdateClass
} from '@renderer/lib/queries'

export function SeatingChartTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: roster, isLoading } = useClassRoster(classSection.id)
  const { data: seats } = useSeatAssignments(classSection.id)
  const assignSeat = useAssignSeat(classSection.id)
  const unassignSeat = useUnassignSeat(classSection.id)
  const clearChart = useClearSeatingChart(classSection.id)
  const updateClass = useUpdateClass()

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const seatByStudentId = useMemo(
    () => new Map((seats ?? []).map((s) => [s.studentId, s])),
    [seats]
  )
  const seatByCell = useMemo(
    () => new Map((seats ?? []).map((s) => [`${s.row}:${s.col}`, s])),
    [seats]
  )

  const students = useMemo(() => (roster ?? []).map((r) => r.student), [roster])
  const unseated = students.filter((s) => !seatByStudentId.has(s.id))
  const studentById = new Map(students.map((s) => [s.id, s]))

  function pickStudent(studentId: string): void {
    setSelectedStudentId((current) => (current === studentId ? null : studentId))
  }

  function placeAt(row: number, col: number): void {
    if (!selectedStudentId) return
    assignSeat.mutate({ studentId: selectedStudentId, row, col })
    setSelectedStudentId(null)
  }

  const rows = classSection.seatingRows
  const cols = classSection.seatingCols

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <label className="flex items-center gap-1.5">
            Rows
            <input
              type="number"
              min={1}
              max={20}
              value={rows}
              onChange={(e) =>
                updateClass.mutate({
                  id: classSection.id,
                  patch: { seatingRows: Math.max(1, Number(e.target.value) || 1) }
                })
              }
              className="w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="flex items-center gap-1.5">
            Columns
            <input
              type="number"
              min={1}
              max={20}
              value={cols}
              onChange={(e) =>
                updateClass.mutate({
                  id: classSection.id,
                  patch: { seatingCols: Math.max(1, Number(e.target.value) || 1) }
                })
              }
              className="w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </label>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirmClear(true)}>
          <RotateCcw size={13} className="mr-1 inline" aria-hidden />
          Clear chart
        </Button>
      </div>

      {!students.length ? (
        <EmptyState
          icon={LayoutGrid}
          title="No students enrolled"
          description="Enroll students from the Roster tab before seating them."
        />
      ) : (
        <div className="flex gap-6">
          <Card className="shrink-0">
            <CardBody>
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">
                Unseated ({unseated.length})
              </p>
              {!unseated.length ? (
                <p className="text-xs text-[var(--color-text-muted)]">Everyone has a seat.</p>
              ) : (
                <ul className="flex w-44 flex-col gap-1">
                  {unseated.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => pickStudent(s.id)}
                        className={cn(
                          'w-full rounded-md border px-2 py-1.5 text-left text-xs',
                          selectedStudentId === s.id
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                        )}
                      >
                        {studentFullName(s)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedStudentId && (
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  Click a seat below to place{' '}
                  <strong>
                    {studentById.get(selectedStudentId)
                      ? studentFullName(studentById.get(selectedStudentId)!)
                      : 'this student'}
                  </strong>
                  .
                </p>
              )}
            </CardBody>
          </Card>

          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: rows }).map((_, row) =>
              Array.from({ length: cols }).map((_, col) => {
                const seat = seatByCell.get(`${row}:${col}`)
                const occupant = seat ? studentById.get(seat.studentId) : undefined
                const isSelected = occupant?.id === selectedStudentId
                return (
                  <button
                    key={`${row}:${col}`}
                    onClick={() => (occupant ? pickStudent(occupant.id) : placeAt(row, col))}
                    onDoubleClick={() => occupant && unassignSeat.mutate(occupant.id)}
                    title={
                      occupant
                        ? `${studentFullName(occupant)} — double-click to unseat`
                        : selectedStudentId
                          ? 'Click to place selected student here'
                          : 'Empty seat'
                    }
                    className={cn(
                      'flex h-16 w-24 flex-col items-center justify-center rounded-lg border text-center text-xs leading-tight',
                      occupant
                        ? isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]'
                        : 'border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
                    )}
                  >
                    {occupant ? studentFullName(occupant) : '—'}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear seating chart"
        message="Unseat every student in this class? This can't be undone."
        confirmLabel="Clear"
        danger
        onConfirm={async () => {
          await clearChart.mutateAsync()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
