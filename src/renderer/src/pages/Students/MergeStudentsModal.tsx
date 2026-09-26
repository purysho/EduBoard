import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import type { Student } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Select } from '@renderer/components/ui/Field'
import { useMergeStudents, useStudents } from '@renderer/lib/queries'
import { ipcErrorMessage, studentFullName } from '@renderer/lib/format'

/**
 * Folds a duplicate student into the one being kept (e.g. someone who joined through a
 * class link as "Chen Mai" when the roster already had "Mai Chen"). Everything moves to
 * the kept student, including their Portal login, and the duplicate is removed.
 */
export function MergeStudentsModal({
  keep: initialKeep,
  duplicate: initialDuplicate,
  onClose,
  onMerged
}: {
  keep: Student
  duplicate?: Student
  onClose: () => void
  onMerged?: (kept: Student) => void
}): React.JSX.Element {
  const { data: students } = useStudents()
  const merge = useMergeStudents()
  const [keep, setKeep] = useState(initialKeep)
  const [duplicateId, setDuplicateId] = useState(initialDuplicate?.id ?? '')
  const duplicate = (students ?? []).find((s) => s.id === duplicateId) ?? initialDuplicate
  const others = (students ?? []).filter((s) => s.id !== keep.id)

  async function handleMerge(): Promise<void> {
    if (!duplicate) return
    const kept = await merge.mutateAsync({ keepId: keep.id, duplicateId: duplicate.id })
    onMerged?.(kept)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Merge duplicate students"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleMerge} disabled={!duplicate || merge.isPending}>
            {merge.isPending ? 'Merging…' : 'Merge'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Keep</p>
            <p className="font-medium">{studentFullName(keep)}</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-40"
            title="Swap which one is kept"
            aria-label="Swap which one is kept"
            disabled={!duplicate}
            onClick={() => {
              if (!duplicate) return
              const oldKeep = keep
              setKeep(duplicate)
              setDuplicateId(oldKeep.id)
            }}
          >
            <ArrowLeftRight size={16} aria-hidden />
          </button>
          <div className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Merge in and remove</p>
            {initialDuplicate ? (
              <p className="font-medium">{duplicate ? studentFullName(duplicate) : '—'}</p>
            ) : (
              <Select value={duplicateId} onChange={(e) => setDuplicateId(e.target.value)}>
                <option value="">Choose a student…</option>
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentFullName(s)}
                    {s.studentNumber ? ` (${s.studentNumber})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-muted)]">
          <li>
            Classes, scores, attendance, submissions, notes and Portal links all move to{' '}
            {studentFullName(keep)}. Where both have something for the same thing (a score for the
            same test, say), {studentFullName(keep)}&apos;s stays.
          </li>
          <li>Details {studentFullName(keep)} is missing (birth date, email…) are filled in.</li>
          <li>
            On the Portal, the duplicate&apos;s login moves across too: the student keeps signing in
            with the same username and password.
          </li>
          <li>A backup is taken first.</li>
        </ul>
        {merge.isError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(merge.error, 'Couldn’t merge. Nothing was changed; try again.')}
          </p>
        )}
      </div>
    </Modal>
  )
}
