import { UploadCloud } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { usePublishStatus, usePublishToPortal } from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

/** Reminds the teacher when students can't see their latest changes yet. */
export function UnpublishedNotice(): React.JSX.Element | null {
  const { data: status } = usePublishStatus()
  const publish = usePublishToPortal()
  if (!status?.configured || status.upToDate) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <UploadCloud size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
      <span className="min-w-0 flex-1">
        {tr("You have changes students can't see yet.")}
        <span className="text-[var(--color-text-muted)]">
          {status.lastPublishedAt
            ? tr(' Last published {date}.', {
                date: formatDate(status.lastPublishedAt, 'MMM d, p')
              })
            : ' ' + tr('Nothing has been published from this computer yet.')}
        </span>
        {publish.isError && (
          <span className="block text-[var(--color-danger)]">
            {ipcErrorMessage(publish.error, tr('Publishing failed. Try again.'))}
          </span>
        )}
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={() => publish.mutate()}
        disabled={publish.isPending}
      >
        {publish.isPending ? tr('Publishing…') : tr('Publish now')}
      </Button>
    </div>
  )
}
