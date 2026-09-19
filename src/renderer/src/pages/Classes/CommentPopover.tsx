import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, MessageSquareText } from 'lucide-react'
import type { Score } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { useUpsertScore } from '@renderer/lib/queries'

export function CommentPopover({
  classId,
  assessmentId,
  studentId,
  score
}: {
  classId: string
  assessmentId: string
  studentId: string
  score: Score | undefined
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [draft, setDraft] = useState('')
  const anchorRef = useRef<HTMLButtonElement>(null)
  const upsertScore = useUpsertScore(classId)

  const hasComment = !!score?.comment

  function handleToggle(): void {
    if (!open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 272) })
      setDraft(score?.comment ?? '')
    }
    setOpen((o) => !o)
  }

  async function handleSave(): Promise<void> {
    await upsertScore.mutateAsync({
      assessmentId,
      studentId,
      pointsEarned: score?.pointsEarned ?? null,
      excused: score?.excused ?? false,
      comment: draft.trim() || null
    })
    setOpen(false)
  }

  const Icon = hasComment ? MessageSquareText : MessageSquare

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={hasComment ? 'Edit comment' : 'Add comment'}
        aria-label={hasComment ? 'Edit comment' : 'Add comment'}
        onClick={handleToggle}
        className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
      >
        <Icon size={11} aria-hidden />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            className="fixed z-50 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            <p className="mb-1.5 text-xs font-semibold">Comment</p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="A note for yourself about this grade…"
              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-primary)]"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={upsertScore.isPending}
              >
                {upsertScore.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
