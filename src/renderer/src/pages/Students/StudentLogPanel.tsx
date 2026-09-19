import { useState } from 'react'
import { NotebookText, Trash2 } from 'lucide-react'
import type { ContactMethod, StudentLogType } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Textarea } from '@renderer/components/ui/Field'
import type { Tone } from '@renderer/lib/grade'
import {
  useCreateStudentLogEntry,
  useDeleteStudentLogEntry,
  useStudentLogEntries,
  useUpdateStudentLogEntry
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { CONTACT_METHOD_LABELS } from '@renderer/lib/parentComms'

const TYPE_META: Record<StudentLogType, { label: string; tone: Tone }> = {
  note: { label: 'Note', tone: 'neutral' },
  positive: { label: 'Positive', tone: 'success' },
  concern: { label: 'Concern', tone: 'warning' },
  contact: { label: 'Contact', tone: 'primary' }
}

const QUICK_ADD: {
  label: string
  type: StudentLogType
  text: string
  contactMethod?: ContactMethod
}[] = [
  { label: 'Missed homework', type: 'concern', text: 'Missed homework.' },
  { label: 'Great participation', type: 'positive', text: 'Great participation in class today.' },
  { label: 'Late to class', type: 'concern', text: 'Arrived late to class.' },
  {
    label: 'Called home',
    type: 'contact',
    text: 'Called home to discuss progress.',
    contactMethod: 'phone'
  },
  { label: 'Emailed guardian', type: 'contact', text: 'Emailed guardian.', contactMethod: 'email' }
]

export function StudentLogPanel({ studentId }: { studentId: string }): React.JSX.Element {
  const { data: entries } = useStudentLogEntries(studentId)
  const createEntry = useCreateStudentLogEntry(studentId)
  const deleteEntry = useDeleteStudentLogEntry(studentId)
  const updateEntry = useUpdateStudentLogEntry()

  const [text, setText] = useState('')
  const [type, setType] = useState<StudentLogType>('note')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone')
  const [followUpNeeded, setFollowUpNeeded] = useState(false)

  async function handleAdd(
    overrideText?: string,
    overrideType?: StudentLogType,
    overrideContactMethod?: ContactMethod
  ): Promise<void> {
    const finalText = (overrideText ?? text).trim()
    if (!finalText) return
    const finalType = overrideType ?? type
    await createEntry.mutateAsync({
      studentId,
      type: finalType,
      text: finalText,
      contactMethod: finalType === 'contact' ? (overrideContactMethod ?? contactMethod) : null,
      followUpNeeded: finalType === 'contact' ? followUpNeeded : false
    })
    setText('')
    setType('note')
    setFollowUpNeeded(false)
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
              onClick={() => handleAdd(q.text, q.type, q.contactMethod)}
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
          {type === 'contact' && (
            <select
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
              className="w-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
            >
              {Object.entries(CONTACT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
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
        {type === 'contact' && (
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={followUpNeeded}
              onChange={(e) => setFollowUpNeeded(e.target.checked)}
            />
            Needs follow-up
          </label>
        )}

        {!entries?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">No log entries yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={TYPE_META[entry.type].tone}>{TYPE_META[entry.type].label}</Badge>
                    {entry.contactMethod && (
                      <Badge tone="neutral">{CONTACT_METHOD_LABELS[entry.contactMethod]}</Badge>
                    )}
                    {entry.followUpNeeded && !entry.followUpDone && (
                      <Badge tone="warning">Follow-up needed</Badge>
                    )}
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(entry.createdAt, 'MMM d, yyyy p')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                  {entry.followUpNeeded && (
                    <button
                      className="mt-1 text-xs text-[var(--color-primary)] hover:underline"
                      onClick={() =>
                        updateEntry.mutate({
                          id: entry.id,
                          studentId,
                          patch: { followUpDone: !entry.followUpDone }
                        })
                      }
                    >
                      Mark follow-up {entry.followUpDone ? 'needed' : 'done'}
                    </button>
                  )}
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
