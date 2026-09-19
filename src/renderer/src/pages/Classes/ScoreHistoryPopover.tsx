import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { History } from 'lucide-react'
import { useScoreHistory } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

function describe(points: number | null, excused: boolean): string {
  if (excused) return 'Excused'
  if (points === null) return 'blank'
  return String(points)
}

export function ScoreHistoryPopover({
  assessmentId,
  studentId
}: {
  assessmentId: string
  studentId: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const { data: history } = useScoreHistory(assessmentId, studentId, open)

  useEffect(() => {
    if (!open) return
    function onClickAway(e: MouseEvent): void {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  function handleToggle(): void {
    if (!open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 232) })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title="Score history"
        aria-label="Score history"
        onClick={handleToggle}
        className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
      >
        <History size={11} aria-hidden />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            className="fixed z-50 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            <p className="mb-1.5 text-xs font-semibold">Change history</p>
            {history === undefined ? (
              <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">No changes recorded yet.</p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-auto">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text)]">
                      {describe(h.previousPoints, h.previousExcused)} →{' '}
                      {describe(h.newPoints, h.newExcused)}
                    </span>
                    <br />
                    {formatDate(h.changedAt, 'MMM d, yyyy p')}
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
