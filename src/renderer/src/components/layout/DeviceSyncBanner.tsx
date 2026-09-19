import { useEffect, useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import type { DeviceSyncStatus } from '@shared/types'
import { formatDate } from '@renderer/lib/format'

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
        This database was last opened on{' '}
        <strong>{status.previousDeviceLabel ?? 'another computer'}</strong>
        {status.previousOpenedAt && <> ({formatDate(status.previousOpenedAt, 'MMM d, yyyy p')})</>}.
        If you also made changes there since, back up before editing here to avoid losing them.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
        aria-label="Dismiss"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}
