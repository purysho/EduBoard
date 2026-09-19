import { useState } from 'react'
import { NotebookText, Trash2 } from 'lucide-react'
import type { StudentLogType } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Textarea } from '@renderer/components/ui/Field'
import type { Tone } from '@renderer/lib/grade'
import {
  useCreateStudentLogEntry,
  useDeleteStudentLogEntry,
  useStudentLogEntries
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

const TYPE_META: Record<StudentLogType, { label: string; tone: Tone }> = {
  note: { label: 'Note', tone: 'neutral' },
  positive: { label: 'Positive', tone: 'success' },
  concern: { label: 'Concern', tone: 'warning' },
  contact: { label: 'Contact', tone: 'primary' }
}

const QUICK_ADD: { label: string; type: StudentLogType; text: string }[] = [
  { label: 'Missed homework', type: 'concern', text: 'Missed homework.' },
  { label: 'Great participation', type: 'positive', text: 'Great participation in class today.' },
  { label: 'Late to class', type: 'concern', text: 'Arrived late to class.' },
  { label: 'Called home', type: 'contact', text: 'Called home to discuss progress.' },
  { label: 'Emailed guardian', type: 'contact', text: 'Emailed guardian.' }
]

export function StudentLogPanel({ studentId }: { studentId: string }): React.JSX.Element {
  const { data: entries } = useStudentLogEntries(studentId)
  const createEntry = useCreateStudentLogEntry(studentId)
  const deleteEntry = useDeleteStudentLogEntry(studentId)

  const [text, setText] = useState('')
  const [type, setType] = useState<StudentLogType>('note')

  async function handleAdd(overrideText?: string, overrideType?: StudentLogType): Promise<void> {
    const finalText = (overrideText ?? text).trim()
    if (!finalText) return
    await createEntry.mutateAsync({ studentId, type: overrideType ?? type, text: finalText })
    setText('')
    setType('note')
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <NotebookText size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Log
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => handleAdd(q.text, q.type)}
              disabled={createEntry.isPending}
              className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              + {q.label}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as StudentLogType)}
            className="w-32 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
          >
            {Object.entries(TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Add a note about this student…"
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={() => handleAdd()}
            disabled={createEntry.isPending || !text.trim()}
          >
            Add
          </Button>
        </div>

        {!entries?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">No log entries yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={TYPE_META[entry.type].tone}>{TYPE_META[entry.type].label}</Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(entry.createdAt, 'MMM d, yyyy p')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                </div>
                <button
                  className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => deleteEntry.mutate(entry.id)}
                  aria-label="Delete entry"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
