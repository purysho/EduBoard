import { useEffect, useState } from 'react'
import type { PortalAiInteraction } from '@shared/aiUsage'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'

/** What a student asked the Portal's Study Helper about one assignment, and what it
 * answered: the evidence behind a "Used AI" badge, fetched live from the Portal. */
export function AiActivityModal({
  studentId,
  studentName,
  homeworkId,
  reasons,
  onClose
}: {
  studentId: string
  studentName: string
  homeworkId: string
  reasons: string[]
  onClose: () => void
}): React.JSX.Element {
  const [items, setItems] = useState<PortalAiInteraction[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.portalSync
      .aiActivity(studentId, homeworkId)
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => !cancelled && setError(ipcErrorMessage(e, 'Could not load AI activity.')))
    return () => {
      cancelled = true
    }
  }, [studentId, homeworkId])

  return (
    <Modal
      open
      onClose={onClose}
      title={`AI use: ${studentName}`}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mb-3 text-xs text-[var(--color-text-muted)]">
        EduBoard only sees the Portal&apos;s own Study Helper. Use of outside tools like ChatGPT
        shows up only if the student ticked &quot;I used AI&quot;. A text match means wording was
        reused from AI answers; it isn&apos;t proof of anything by itself.
      </p>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {!items && !error && <Spinner />}
      {items && items.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          No Study Helper questions were asked from this assignment.
        </p>
      )}
      {items && items.length > 0 && (
        <ol className="max-h-[50vh] space-y-3 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-[var(--color-border)] p-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatDate(item.createdAt, 'MMM d, p')}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">Student: </span>
                {item.question}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
                <span className="font-semibold text-[var(--color-text)]">AI: </span>
                {item.reply}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
