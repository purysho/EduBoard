import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudUpload } from 'lucide-react'
import { useExtraBackupStatus } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

const SNOOZE_KEY = 'eduboard.backupReminderSnoozedUntil'
const SNOOZE_DAYS = 14

function snoozedUntil(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    return 0
  }
}

/** Nudges the teacher when their backups exist only on this computer, or the second
 * copy has gone stale (e.g. the USB stick hasn't been plugged in for a while). */
export function BackupReminder({ hasData }: { hasData: boolean }): React.JSX.Element | null {
  const { data: status } = useExtraBackupStatus()
  const [hidden, setHidden] = useState(() => snoozedUntil() > Date.now())
  // The sample school's made-up data is never backed up.
  const { data: inSample } = useQuery({
    queryKey: ['sampleSchool'],
    queryFn: () => window.api.sampleSchool.status(),
    staleTime: Infinity
  })
  if (!status?.needsAttention || !hasData || hidden || inSample !== false) return null

  const message = !status.folder
    ? tr('Your backups are only on this computer. If it’s lost or breaks, they go with it.')
    : !status.reachable
      ? tr('Your second backup folder can’t be reached, so nothing has been copied there lately.')
      : status.lastCopiedAt
        ? tr('The last backup copied to your second folder was on {date}.', {
            date: formatDate(status.lastCopiedAt)
          })
        : tr('Nothing has been copied to your second backup folder yet.')

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <CloudUpload size={16} className="shrink-0 text-[var(--color-warning)]" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      <Link
        to="/settings?section=data"
        className="font-medium text-[var(--color-primary)] hover:underline"
      >
        {status.folder ? tr('Check backups') : tr('Set up a second copy')}
      </Link>
      <button
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        onClick={() => {
          try {
            localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000))
          } catch {
            // Not remembered; it just shows again next time.
          }
          setHidden(true)
        }}
      >
        {tr('Remind me later')}
      </button>
    </div>
  )
}
