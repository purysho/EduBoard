import { useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Input, Label, Select } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import {
  useAllScheduleSlots,
  useClasses,
  useCreateScheduleSlot,
  useDeleteScheduleSlot
} from '@renderer/lib/queries'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' }
]

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function TimetablePage(): React.JSX.Element {
  const { data: slots, isLoading } = useAllScheduleSlots()
  const { data: classes } = useClasses()
  const createSlot = useCreateScheduleSlot()
  const deleteSlot = useDeleteScheduleSlot()

  const [classId, setClassId] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:50')
  const [room, setRoom] = useState('')

  async function handleAdd(): Promise<void> {
    if (!classId || !startTime || !endTime) return
    await createSlot.mutateAsync({
      classId,
      dayOfWeek,
      startTime,
      endTime,
      room: room.trim() || null
    })
    setRoom('')
  }

  if (isLoading) return <Spinner />

  const slotsByDay = new Map<number, typeof slots>()
  for (const day of DAYS) slotsByDay.set(day.value, [])
  for (const slot of slots ?? []) {
    slotsByDay.get(slot.dayOfWeek)?.push(slot)
  }
  for (const list of slotsByDay.values()) {
    list?.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return (
    <div>
      <PageHeader
        title="Timetable"
        description="Every class's weekly meeting times, at a glance."
      />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Label>Class</Label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class…</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36">
              <Label>Day</Label>
              <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-28">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="w-28">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="w-32">
              <Label>Room</Label>
              <Input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button onClick={handleAdd} disabled={!classId || createSlot.isPending}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      {!slots?.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No scheduled classes yet"
          description="Add a class's weekly meeting time above to build out the timetable."
        />
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {DAYS.map((day) => (
            <div key={day.value}>
              <h2 className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">
                {day.label}
              </h2>
              <div className="space-y-2">
                {slotsByDay.get(day.value)?.length ? (
                  slotsByDay.get(day.value)!.map((slot) => (
                    <Card key={slot.id}>
                      <CardBody className="space-y-1 !p-3">
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className="text-sm font-medium"
                            style={{ color: slot.classColor ?? undefined }}
                          >
                            {slot.className}
                          </span>
                          <button
                            className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                            onClick={() => deleteSlot.mutate(slot.id)}
                            aria-label="Remove slot"
                          >
                            <Trash2 size={12} aria-hidden />
                          </button>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                        </p>
                        {slot.room && (
                          <p className="text-xs text-[var(--color-text-muted)]">{slot.room}</p>
                        )}
                      </CardBody>
                    </Card>
                  ))
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
