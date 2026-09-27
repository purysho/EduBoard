import { useState } from 'react'
import { CloudUpload, FolderOpen, HardDriveDownload, ShieldCheck, Sheet } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { RestoreDialog } from './RestoreDialog'
import {
  useBackups,
  useChangeExtraBackupFolder,
  useCreateBackup,
  useExtraBackupStatus
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

const AUTO_BACKUP_RETENTION_HINT = '10'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The second copy of every backup, somewhere that survives this computer. */
function ExtraBackupFolder(): React.JSX.Element {
  const { data: status } = useExtraBackupStatus()
  const change = useChangeExtraBackupFolder()
  if (!status) return <></>

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-border)] p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <CloudUpload size={14} aria-hidden /> {tr('Second copy')}
      </p>
      {!status.folder ? (
        <p className="mt-1 text-[var(--color-text-muted)]">
          {tr(
            'Backups are only on this computer. Choose a second place, such as a OneDrive or Baidu Netdisk folder, or a USB stick, and every backup is copied there too.'
          )}
        </p>
      ) : (
        <p className="mt-1 text-[var(--color-text-muted)]">
          {tr('Copying to')} <span className="break-all font-mono text-xs">{status.folder}</span>
          {status.reachable ? (
            status.lastCopiedAt ? (
              <>
                {' '}
                {tr('· last copy {date}', {
                  date: formatDate(status.lastCopiedAt, 'MMM d, yyyy p')
                })}
              </>
            ) : (
              <> {tr('· no copies yet')}</>
            )
          ) : (
            <span className="text-[var(--color-warning)]">
              {' '}
              {tr(
                "· can't reach it (is the USB stick plugged in?). Backups carry on here and are copied again once it's back."
              )}
            </span>
          )}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button
          variant={status.folder ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => change.mutate('choose')}
          disabled={change.isPending}
        >
          {status.folder ? tr('Change folder') : tr('Choose folder')}
        </Button>
        {status.folder && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => change.mutate('clear')}
            disabled={change.isPending}
          >
            {tr('Stop copying')}
          </Button>
        )}
      </div>
    </div>
  )
}

export function BackupPanel(): React.JSX.Element {
  const { data: backups } = useBackups()
  const createBackup = useCreateBackup()
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [exported, setExported] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Backups')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            title={tr(
              "Everything (except settings) as one Excel file, a sheet per kind of data, for handing over. It isn't a backup: EduBoard can't restore from it."
            )}
            onClick={async () => {
              const r = await window.api.importExport.exportEverything()
              setExported(
                r.saved
                  ? tr('Exported {sheets} sheets to {path}', { sheets: r.sheets, path: r.filePath })
                  : null
              )
            }}
          >
            <Sheet size={14} className="mr-1 inline" aria-hidden />
            {tr('Export everything (Excel)')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.api.backup.revealFolder()}>
            <FolderOpen size={14} className="mr-1 inline" aria-hidden />
            {tr('Open folder')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => createBackup.mutate()}
            disabled={createBackup.isPending}
          >
            <HardDriveDownload size={14} className="mr-1 inline" aria-hidden />
            {createBackup.isPending ? tr('Backing up…') : tr('Back up now')}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {exported && <p className="mb-3 text-sm text-[var(--color-text-muted)]">{exported}</p>}
        <ExtraBackupFolder />
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">
          {tr(
            'EduBoard automatically backs up your database every time it starts (the last {AUTOBACKUPRETENTIONHINT} are kept) and once a day while it stays open, on top of anything you back up manually here.',
            { AUTOBACKUPRETENTIONHINT: AUTO_BACKUP_RETENTION_HINT }
          )}
        </p>
        {!backups?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">{tr('No backups yet.')}</p>
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
                      {tr('Auto')}
                    </span>
                  )}
                </span>
                <button
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  onClick={() => setRestoreTarget(b.filePath)}
                >
                  {tr('Restore')}
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
