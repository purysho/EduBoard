import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, LayoutGrid, RotateCcw, Star, Undo2 } from 'lucide-react'
import type { ClassSection, Student } from '@shared/types'
import { startOfWeekIso } from '@shared/classroomTools'
import { PointCategoryChips } from '@renderer/components/PointCategoryChips'
import { usePresenting } from '@renderer/lib/presenting'
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
  useSettings,
  useUnassignSeat,
  useUpdateClass
} from '@renderer/lib/queries'
import { tr } from '@shared/i18n'
import { trNodes } from '@renderer/lib/trNodes'
import { ClassGraphSeating } from './ClassGraphSeating'

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
  // Arranging seats, or giving class points by tapping a seat.
  const [mode, setMode] = useState<'arrange' | 'points'>('arrange')
  const [category, setCategory] = useState<string | null>(null)

  const qc = useQueryClient()
  const week = startOfWeekIso()
  const pointsKey = ['behaviourPoints', classSection.id, week]
  const { data: totals } = useQuery({
    queryKey: pointsKey,
    queryFn: () => window.api.behaviourPoints.totals(classSection.id, week)
  })
  const weekPoints = new Map((totals ?? []).map((t) => [t.studentId, t.week]))
  async function give(studentId: string, points: number): Promise<void> {
    await window.api.behaviourPoints.add({
      classId: classSection.id,
      studentId,
      points,
      category
    })
    void qc.invalidateQueries({ queryKey: pointsKey })
  }

  // Fields the school marked "show on the seating chart" (allergies, support plan…):
  // a seat gets an icon when something is recorded in one. Never while presenting.
  const { data: settings } = useSettings()
  const presenting = usePresenting()
  const flagged = presenting ? [] : (settings?.studentFields ?? []).filter((f) => f.onSeatingChart)
  const needsOf = (s: Student): string[] =>
    flagged
      .map((f) => [f.label, s.customFields?.[f.id]?.trim() ?? ''] as const)
      .filter(([, v]) => v)
      .map(([label, v]) => `${label}: ${v}`)

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
            {tr('Rows')}
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
            {tr('Columns')}
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
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={tr('Seating chart mode')}
            className="flex overflow-hidden rounded-md border border-[var(--color-border)] text-xs"
          >
            {(
              [
                ['arrange', tr('Arrange seats')],
                ['points', tr('Give points')]
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                aria-pressed={mode === m}
                className={cn(
                  'px-2.5 py-1',
                  mode === m
                    ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                )}
                onClick={() => {
                  setMode(m)
                  setSelectedStudentId(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'arrange' ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmClear(true)}>
                <RotateCcw size={13} className="mr-1 inline" aria-hidden />
                {tr('Clear chart')}
              </Button>
              {!presenting && <ClassGraphSeating classSection={classSection} />}
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await window.api.behaviourPoints.undoLast(classSection.id)
                void qc.invalidateQueries({ queryKey: pointsKey })
              }}
            >
              <Undo2 size={13} className="mr-1 inline" aria-hidden />
              {tr('Undo last')}
            </Button>
          )}
        </div>
      </div>
      {mode === 'points' && (
        <div className="mb-3 space-y-1">
          <PointCategoryChips value={category} onChange={setCategory} />
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              'Tap a seat for +1, or its − for −1. The number is this week’s points, the same as in the Classroom tab.'
            )}
          </p>
        </div>
      )}

      {!students.length ? (
        <EmptyState
          icon={LayoutGrid}
          title={tr('No students enrolled')}
          description={tr('Enroll students from the Roster tab before seating them.')}
        />
      ) : (
        <div className="flex gap-6">
          <Card className="shrink-0">
            <CardBody>
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">
                {tr('Unseated ({length})', { length: unseated.length })}
              </p>
              {!unseated.length ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {tr('Everyone has a seat.')}
                </p>
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
                  {trNodes('Click a seat below to place {student}.', {
                    student: (
                      <strong>
                        {studentById.get(selectedStudentId)
                          ? studentFullName(studentById.get(selectedStudentId)!)
                          : tr('this student')}
                      </strong>
                    )
                  })}
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
                const needs = occupant ? needsOf(occupant) : []
                if (mode === 'points') {
                  const pts = occupant ? (weekPoints.get(occupant.id) ?? 0) : 0
                  return occupant ? (
                    <div key={`${row}:${col}`} className="relative">
                      <button
                        onClick={() => give(occupant.id, 1)}
                        title={tr('+1 for {name}', { name: studentFullName(occupant) })}
                        className="flex h-16 w-24 flex-col items-center justify-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs leading-tight hover:border-[var(--color-success)] hover:bg-[var(--color-success-soft)]"
                      >
                        <span className="line-clamp-2 px-1">{studentFullName(occupant)}</span>
                        <span
                          className={cn(
                            'flex items-center gap-0.5 rounded-full px-1.5 text-[11px] font-semibold',
                            pts < 0
                              ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                              : 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                          )}
                        >
                          <Star size={10} aria-hidden />
                          {pts}
                        </span>
                      </button>
                      <button
                        aria-label={tr('−1 for {name}', { name: studentFullName(occupant) })}
                        title={tr('−1 for {name}', { name: studentFullName(occupant) })}
                        onClick={() => give(occupant.id, -1)}
                        className="absolute right-0.5 top-0.5 rounded px-1 text-xs leading-none text-[var(--color-text-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                      >
                        −
                      </button>
                      {needs.length > 0 && <NeedsIcon needs={needs} />}
                    </div>
                  ) : (
                    <div
                      key={`${row}:${col}`}
                      className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]"
                    >
                      —
                    </div>
                  )
                }
                return (
                  <div key={`${row}:${col}`} className="relative">
                    <button
                      onClick={() => (occupant ? pickStudent(occupant.id) : placeAt(row, col))}
                      onDoubleClick={() => occupant && unassignSeat.mutate(occupant.id)}
                      title={
                        occupant
                          ? tr('{name} — double-click to unseat', {
                              name: studentFullName(occupant)
                            })
                          : selectedStudentId
                            ? tr('Click to place selected student here')
                            : tr('Empty seat')
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
                    {needs.length > 0 && <NeedsIcon needs={needs} />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {flagged.length > 0 && (
        <p className="mt-3 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <Info size={12} className="text-[var(--color-warning)]" aria-hidden />
          {tr('Something is recorded in {fields}. Point to the icon to see it.', {
            fields: [...new Set(flagged.map((f) => f.label))].join(', ')
          })}
        </p>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={tr('Clear seating chart')}
        message={tr("Unseat every student in this class? This can't be undone.")}
        confirmLabel={tr('Clear')}
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

/** A small icon on a seat for what the school wants visible at a glance (allergies, a
 * support plan…); the details show on hover. */
function NeedsIcon({ needs }: { needs: string[] }): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={needs.join('; ')}
      title={needs.join('\n')}
      className="absolute bottom-0.5 left-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-warning)]"
    >
      <Info size={13} aria-hidden />
    </span>
  )
}
