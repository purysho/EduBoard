import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { useBackupPreview } from '@renderer/lib/queries'

const CONFIRM_WORD = 'RESTORE'

interface RestoreDialogProps {
  backupFilePath: string | null
  onConfirm: () => void
  onCancel: () => void
}

function Row({
  label,
  current,
  backup
}: {
  label: string
  current: number
  backup: number
}): React.JSX.Element {
  const changed = current !== backup
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={changed ? 'font-medium text-[var(--color-danger)]' : 'font-medium'}>
        {current} <span className="text-[var(--color-text-muted)]">now</span>
        {' -> '}
        {backup} <span className="text-[var(--color-text-muted)]">in backup</span>
      </span>
    </div>
  )
}

export function RestoreDialog({
  backupFilePath,
  onConfirm,
  onCancel
}: RestoreDialogProps): React.JSX.Element {
  const { data: preview, isLoading } = useBackupPreview(backupFilePath)
  const [typed, setTyped] = useState('')

  const open = !!backupFilePath

  function handleCancel(): void {
    setTyped('')
    onCancel()
  }

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title="Restore backup"
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={typed !== CONFIRM_WORD}
            onClick={() => {
              setTyped('')
              onConfirm()
            }}
          >
            Restore &amp; restart
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-[var(--color-danger)]"
            aria-hidden
          />
          This replaces everything currently in EduBoard with this backup, then restarts the app.
          Anything added or changed since this backup was taken will be permanently lost.
        </p>

        {isLoading ? (
          <Spinner />
        ) : preview ? (
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <Row
              label="Students"
              current={preview.current.students}
              backup={preview.backup.students}
            />
            <Row
              label="Classes"
              current={preview.current.classes}
              backup={preview.backup.classes}
            />
            <Row
              label="Scores recorded"
              current={preview.current.scores}
              backup={preview.backup.scores}
            />
            <Row
              label="Attendance records"
              current={preview.current.attendanceRecords}
              backup={preview.backup.attendanceRecords}
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            Type {CONFIRM_WORD} to confirm
          </label>
          <input
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            placeholder={CONFIRM_WORD}
          />
        </div>
      </div>
    </Modal>
  )
}
