import { useState } from 'react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useBackups, useCreateBackup } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupPanel(): React.JSX.Element {
  const { data: backups } = useBackups()
  const createBackup = useCreateBackup()
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Backups</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.api.backup.revealFolder()}>
            Open folder
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => createBackup.mutate()}
            disabled={createBackup.isPending}
          >
            {createBackup.isPending ? 'Backing up…' : 'Back up now'}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">
          A backup is a full copy of your database. Keep a recent one on a USB stick in case this
          laptop is lost or damaged.
        </p>
        {!backups?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">No backups yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {backups.map((b) => (
              <li key={b.filePath} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatDate(b.createdAt, 'MMM d, yyyy p')}{' '}
                  <span className="text-[var(--color-text-muted)]">
                    · {formatSize(b.sizeBytes)}
                  </span>
                </span>
                <button
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  onClick={() => setRestoreTarget(b.filePath)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore backup"
        message="This replaces everything currently in EduBoard with this backup, then restarts the app. Any changes made since this backup was taken will be lost."
        confirmLabel="Restore & restart"
        danger
        onConfirm={() => {
          if (restoreTarget) window.api.backup.restore(restoreTarget)
          setRestoreTarget(null)
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </Card>
  )
}
