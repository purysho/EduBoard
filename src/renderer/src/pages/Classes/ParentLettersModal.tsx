import { useState } from 'react'
import type { ClassSection } from '@shared/types'
import { DEFAULT_LETTER_TEMPLATE } from '@shared/letters'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'

/** Edit the parent letter and print a copy for every student in the class. */
export function ParentLettersModal({
  open,
  onClose,
  classSection
}: {
  open: boolean
  onClose: () => void
  classSection: ClassSection
}): React.JSX.Element {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const text = draft ?? settings?.letterTemplate ?? DEFAULT_LETTER_TEMPLATE

  async function print(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      if (draft !== null) await update.mutateAsync({ letterTemplate: draft })
      const r = await window.api.print.printClassLetters(
        classSection.id,
        `${classSection.name.replace(/[^\p{L}\p{N} -]/gu, '')} - parent letters.pdf`
      )
      if (r.saved) setMessage(`Saved to ${r.filePath}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Parent letters — ${classSection.name}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_LETTER_TEMPLATE)}>
            Restore EduBoard’s letter
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={print} disabled={busy || !text.trim()}>
            {busy ? 'Preparing…' : 'Print letters (PDF)'}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm">
        <p className="text-[var(--color-text-muted)]">
          One letter per student, filled in for each: {'{guardian}'}, {'{name}'}, {'{class}'},{' '}
          {'{grade}'}, {'{percent}'}, {'{attendance}'}, {'{teacher}'}, {'{school}'}, {'{date}'}. The
          school logo and name go at the top. Your letter is kept for next time.
        </p>
        <textarea
          aria-label="Letter"
          className="h-72 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm"
          value={text}
          onChange={(e) => setDraft(e.target.value)}
        />
        {message && <p className="text-[var(--color-text-muted)]">{message}</p>}
      </div>
    </Modal>
  )
}
