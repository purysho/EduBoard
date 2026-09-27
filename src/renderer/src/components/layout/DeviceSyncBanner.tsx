import { useEffect, useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import type { DeviceSyncStatus } from '@shared/types'
import { formatDate } from '@renderer/lib/format'
import { tr } from '@shared/i18n'
import { trNodes } from '@renderer/lib/trNodes'

export function DeviceSyncBanner(): React.JSX.Element | null {
  const [status, setStatus] = useState<DeviceSyncStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.api.deviceSync.check().then(setStatus)
  }, [])

  if (dismissed || !status?.openedOnAnotherDevice) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2 text-sm">
      <span className="flex items-center gap-2">
        <TriangleAlert size={15} className="shrink-0 text-[var(--color-warning)]" aria-hidden />
        <span>
          {trNodes(
            'This database was last opened on {device}{when}. If you also made changes there since, back up before editing here to avoid losing them.',
            {
              device: <strong>{status.previousDeviceLabel ?? tr('another computer')}</strong>,
              when: status.previousOpenedAt
                ? ` (${formatDate(status.previousOpenedAt, 'MMM d, yyyy p')})`
                : ''
            }
          )}
        </span>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
        aria-label={tr('Dismiss')}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}
