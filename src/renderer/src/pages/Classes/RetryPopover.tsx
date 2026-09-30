import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'
import { useAddScoreAttempt, useScoreAttempts } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

export function RetryPopover({
  classId,
  assessmentId,
  studentId,
  maxScore
}: {
  classId: string
  assessmentId: string
  studentId: string
  maxScore: number
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)

  function toggle(): void {
    if (!open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 260) })
    }
    setOpen((value) => !value)
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={tr('Add retry')}
        aria-label={tr('Add retry')}
        onClick={toggle}
        className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
      >
        <RotateCcw size={11} aria-hidden />
      </button>
      {open && position && (
        <RetryPanel
          classId={classId}
          assessmentId={assessmentId}
          studentId={studentId}
          maxScore={maxScore}
          position={position}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function RetryPanel({
  classId,
  assessmentId,
  studentId,
  maxScore,
  position,
  anchorRef,
  onClose
}: {
  classId: string
  assessmentId: string
  studentId: string
  maxScore: number
  position: { top: number; left: number }
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}): React.JSX.Element {
  const { data: attempts } = useScoreAttempts(assessmentId, studentId, true)
  const addAttempt = useAddScoreAttempt(classId)
  const [value, setValue] = useState('')

  useEffect(() => {
    function onClickAway(e: MouseEvent): void {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        const panel = document.querySelector('[data-retry-panel]')
        if (!panel?.contains(e.target as Node)) onClose()
      }
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [anchorRef, onClose])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const pointsEarned = Number(value)
    if (!Number.isFinite(pointsEarned) || pointsEarned < 0 || pointsEarned > maxScore) return
    await addAttempt.mutateAsync({ assessmentId, studentId, pointsEarned })
    setValue('')
  }

  return createPortal(
    <div
      data-retry-panel
      className="fixed z-50 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <p className="text-xs font-semibold">{tr('Retries — highest score counts')}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        {tr('The first retry also saves the original grade as Attempt 1.')}
      </p>
      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <label className="flex-1 text-xs text-[var(--color-text-muted)]">
          {tr('New attempt')}
          <input
            type="number"
            min={0}
            max={maxScore}
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
          />
        </label>
        <button
          type="submit"
          disabled={addAttempt.isPending || value === ''}
          className="rounded bg-[var(--color-primary)] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {tr('Add')}
        </button>
      </form>
      {addAttempt.error && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{String(addAttempt.error.message)}</p>
      )}
      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
        {attempts === undefined ? (
          <p className="text-xs text-[var(--color-text-muted)]">{tr('Loading…')}</p>
        ) : attempts.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">{tr('No retries yet.')}</p>
        ) : (
          <ul className="space-y-1">
            {attempts.map((attempt) => (
              <li key={attempt.id} className="flex justify-between gap-2 text-xs">
                <span>{tr('Attempt {number}', { number: attempt.attemptNumber })}</span>
                <span className="font-medium">
                  {attempt.pointsEarned}/{maxScore}
                  <span className="ml-2 font-normal text-[var(--color-text-muted)]">
                    {formatDate(attempt.createdAt, 'MMM d, p')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  )
}
