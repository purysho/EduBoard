import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useAllHomeworkAssignments } from '@renderer/lib/queries'
import type { HomeworkAssignmentWithClass } from '@shared/types'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { data: assignments, isLoading } = useAllHomeworkAssignments()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, HomeworkAssignmentWithClass[]>()
    for (const a of assignments ?? []) {
      if (!a.dueDate) continue
      const key = a.dueDate.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(a)
      map.set(key, list)
    }
    return map
  }, [assignments])

  if (isLoading) return <Spinner />

  const gridStart = startOfWeek(startOfMonth(month))
  const gridEnd = endOfWeek(endOfMonth(month))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const selectedAssignments = selectedDay ? (byDate.get(selectedDay) ?? []) : []

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Homework due dates across every class, in one place."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft size={15} aria-hidden />
            </Button>
            <span className="min-w-[9rem] text-center text-sm font-medium">
              {format(month, 'MMMM yyyy')}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight size={15} aria-hidden />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-1 text-center text-xs font-semibold text-[var(--color-text-muted)]"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dueToday = byDate.get(key) ?? []
          const inMonth = isSameMonth(day, month)
          const selected = selectedDay === key
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(dueToday.length ? key : null)}
              className={`min-h-[72px] rounded-lg border p-2 text-left transition-colors ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <span
                className={`text-xs ${isToday(day) ? 'font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dueToday.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: a.classColor ?? 'var(--color-primary)' }}
                  >
                    {a.title}
                  </div>
                ))}
                {dueToday.length > 3 && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    +{dueToday.length - 3} more
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {!selectedDay ? (
          !assignments?.length && (
            <EmptyState
              icon={ClipboardList}
              title="No homework due dates yet"
              description="Add due dates to assignments from a class's Homework tab and they'll show up here."
            />
          )
        ) : (
          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold">
                {format(parseISO(selectedDay), 'EEEE, MMMM d')}
              </h2>
              <div className="space-y-2">
                {selectedAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: a.classColor ?? 'var(--color-primary)' }}
                        />
                        <span className="truncate text-sm font-medium">{a.title}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {a.className}
                        {a.topic ? ` · ${a.topic}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/classes/${a.classId}/homework`)}
                    >
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
