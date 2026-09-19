import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Paperclip, Trash2 } from 'lucide-react'
import type { AssignmentSubmission } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { useDeleteAssignmentSubmission, useUpsertAssignmentSubmission } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

export function SubmissionPopover({
  classId,
  assessmentId,
  studentId,
  submission
}: {
  classId: string
  assessmentId: string
  studentId: string
  submission: AssignmentSubmission | undefined
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const upsertSubmission = useUpsertAssignmentSubmission(classId)
  const deleteSubmission = useDeleteAssignmentSubmission(classId, assessmentId)

  function handleToggle(): void {
    if (!open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 260) })
    }
    setOpen((o) => !o)
  }

  async function handleAttach(): Promise<void> {
    const filePath = await window.api.assignmentSubmissions.pickFile()
    if (!filePath) return
    const fileName = filePath.split(/[/\\]/).pop() ?? filePath
    await upsertSubmission.mutateAsync({ assessmentId, studentId, filePath, fileName })
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={submission ? `Submission: ${submission.fileName}` : 'Attach a submission'}
        aria-label={submission ? `Submission: ${submission.fileName}` : 'Attach a submission'}
        onClick={handleToggle}
        className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
      >
        <Paperclip size={11} aria-hidden />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            className="fixed z-50 w-60 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            <p className="mb-1.5 text-xs font-semibold">Submission</p>
            {submission ? (
              <div className="space-y-2">
                <button
                  className="block w-full truncate rounded-md border border-[var(--color-border)] px-2 py-1.5 text-left text-xs hover:border-[var(--color-primary)]"
                  title={submission.filePath}
                  onClick={() => window.api.assignmentSubmissions.openPath(submission.filePath)}
                >
                  {submission.fileName}
                </button>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Submitted {formatDate(submission.submittedAt, 'MMM d, yyyy p')}
                </p>
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="sm" onClick={handleAttach}>
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubmission.mutate(submission.id)}
                  >
                    <Trash2 size={12} className="mr-1 inline" aria-hidden />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={handleAttach}>
                  Attach file…
                </Button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
