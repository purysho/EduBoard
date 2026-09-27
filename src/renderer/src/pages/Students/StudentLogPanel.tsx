import { useState } from 'react'
import { NotebookText, Trash2 } from 'lucide-react'
import { defaultLogQuickAdds, type ContactMethod, type StudentLogType } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Textarea } from '@renderer/components/ui/Field'
import type { Tone } from '@renderer/lib/grade'
import {
  useSettings,
  useCreateStudentLogEntry,
  useDeleteStudentLogEntry,
  useStudentLogEntries,
  useUpdateStudentLogEntry
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { CONTACT_METHOD_LABELS } from '@renderer/lib/parentComms'
import { tr } from '@shared/i18n'

const TYPE_META: Record<StudentLogType, { label: string; tone: Tone }> = {
  note: { label: tr('Note'), tone: 'neutral' },
  positive: { label: tr('Positive'), tone: 'success' },
  concern: { label: tr('Concern'), tone: 'warning' },
  contact: { label: tr('Contact'), tone: 'primary' }
}

export function StudentLogPanel({ studentId }: { studentId: string }): React.JSX.Element {
  const { data: settings } = useSettings()
  const quickAdds = settings?.logQuickAdds ?? defaultLogQuickAdds()
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
          {tr('Log')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {quickAdds.map((q, i) => (
            <button
              key={`${i}-${q.label}`}
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
            placeholder={tr('Add a note about this student…')}
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={() => handleAdd()}
            disabled={createEntry.isPending || !text.trim()}
          >
            {tr('Add')}
          </Button>
        </div>
        {type === 'contact' && (
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={followUpNeeded}
              onChange={(e) => setFollowUpNeeded(e.target.checked)}
            />
            {tr('Needs follow-up')}
          </label>
        )}

        {!entries?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">{tr('No log entries yet.')}</p>
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
                      <Badge tone="warning">{tr('Follow-up needed')}</Badge>
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
                      {entry.followUpDone ? tr('Mark follow-up needed') : tr('Mark follow-up done')}
                    </button>
                  )}
                </div>
                <button
                  className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => deleteEntry.mutate(entry.id)}
                  aria-label={tr('Delete entry')}
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
