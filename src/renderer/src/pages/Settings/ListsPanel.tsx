import { useState } from 'react'
import { ListChecks, Plus, X } from 'lucide-react'
import {
  DEFAULT_LOG_QUICK_ADDS,
  STUDENT_LOG_TYPES,
  type LogQuickAdd,
  type StudentField,
  type StudentLogType
} from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'

const TYPE_LABELS: Record<StudentLogType, string> = {
  note: 'Note',
  positive: 'Positive',
  concern: 'Concern',
  contact: 'Parent contact'
}

const inputClass =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm'

/** Settings → Your lists: the log's one-tap buttons and extra student fields. */
export function ListsPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [quick, setQuick] = useState<LogQuickAdd[] | null>(null)
  const [fields, setFields] = useState<StudentField[] | null>(null)
  if (!settings) return null
  const q = quick ?? settings.logQuickAdds
  const f = fields ?? settings.studentFields
  const dirty = quick !== null || fields !== null
  const valid = q.every((x) => x.label.trim() && x.text.trim()) && f.every((x) => x.label.trim())

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Your lists
        </h2>
      </CardHeader>
      <CardBody className="space-y-5 text-sm">
        <section>
          <h3 className="font-medium">Quick-add buttons on a student’s log</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            One tap adds the entry. Parent-contact entries appear under Communications.
          </p>
          <div className="space-y-1.5">
            {q.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label="Button label"
                  className={`${inputClass} w-44`}
                  value={item.label}
                  placeholder="Button label"
                  onChange={(e) =>
                    setQuick(q.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <select
                  aria-label="Kind of entry"
                  className={inputClass}
                  value={item.type}
                  onChange={(e) =>
                    setQuick(
                      q.map((x, j) =>
                        j === i ? { ...x, type: e.target.value as StudentLogType } : x
                      )
                    )
                  }
                >
                  {STUDENT_LOG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Text it adds"
                  className={`${inputClass} flex-1`}
                  value={item.text}
                  placeholder="Text it adds"
                  onChange={(e) =>
                    setQuick(q.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
                <button
                  aria-label={`Remove ${item.label || 'button'}`}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => setQuick(q.filter((_, j) => j !== i))}
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button
              className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
              onClick={() => setQuick([...q, { label: '', type: 'note', text: '' }])}
            >
              <Plus size={12} aria-hidden />
              Add a button
            </button>
            <button
              className="text-[var(--color-text-muted)] hover:underline"
              onClick={() => setQuick(DEFAULT_LOG_QUICK_ADDS)}
            >
              Restore EduBoard’s
            </button>
          </div>
        </section>

        <section>
          <h3 className="font-medium">Extra student fields</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            Things to record about every student, such as house, allergies or support plan. They
            appear on the student form and page, and a roster import fills them from columns with
            the same name. They stay on this computer (never sent to the Portal).
          </p>
          <div className="space-y-1.5">
            {f.map((field, i) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  aria-label="Field name"
                  className={`${inputClass} w-64`}
                  value={field.label}
                  placeholder="e.g. House"
                  onChange={(e) =>
                    setFields(f.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <button
                  aria-label={`Remove ${field.label || 'field'}`}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => setFields(f.filter((_, j) => j !== i))}
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button
            className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
            onClick={() => setFields([...f, { id: crypto.randomUUID(), label: '' }])}
          >
            <Plus size={12} aria-hidden />
            Add a field
          </button>
          {settings.studentFields.some((old) => !f.find((x) => x.id === old.id)) && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              A removed field is hidden; what was recorded in it is kept, and comes back if you add
              it again from a school pack.
            </p>
          )}
        </section>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || !valid || update.isPending}
            onClick={async () => {
              await update.mutateAsync({
                logQuickAdds: q.map((x) => ({ ...x, label: x.label.trim(), text: x.text.trim() })),
                studentFields: f.map((x) => ({ ...x, label: x.label.trim() }))
              })
              setQuick(null)
              setFields(null)
            }}
          >
            Save lists
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuick(null)
                setFields(null)
              }}
            >
              Undo changes
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
