import { useState } from 'react'
import { FolderOpen, HardDriveDownload, ShieldCheck } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { RestoreDialog } from './RestoreDialog'
import { useBackups, useCreateBackup } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

const AUTO_BACKUP_RETENTION_HINT = '10'

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
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Backups
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.api.backup.revealFolder()}>
            <FolderOpen size={14} className="mr-1 inline" aria-hidden />
            Open folder
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => createBackup.mutate()}
            disabled={createBackup.isPending}
          >
            <HardDriveDownload size={14} className="mr-1 inline" aria-hidden />
            {createBackup.isPending ? 'Backing up…' : 'Back up now'}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">
          EduBoard automatically backs up your database every time it starts (the last{' '}
          {AUTO_BACKUP_RETENTION_HINT} are kept), on top of anything you back up manually here. Keep
          a recent one on a USB stick in case this laptop is lost or damaged.
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
                  {b.automatic && (
                    <span className="ml-1.5 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      Auto
                    </span>
                  )}
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

      <RestoreDialog
        backupFilePath={restoreTarget}
        onConfirm={() => {
          if (restoreTarget) window.api.backup.restore(restoreTarget)
          setRestoreTarget(null)
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </Card>
  )
}
