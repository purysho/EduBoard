import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpCircle } from 'lucide-react'
import { useAppUpdateStatus } from '@renderer/lib/queries'

/** Across the top of every page once an update has downloaded: it installs next time
 * EduBoard opens, or now from Settings. "Later" hides the banner for this session only;
 * the sidebar icon and the Settings badge stay until the update is installed. */
export function UpdateBanner(): React.JSX.Element | null {
  const { data: status } = useAppUpdateStatus()
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const version = status?.readyVersion
  if (!version || hiddenFor === version) return null
  return (
    <div className="no-print flex flex-wrap items-center gap-3 border-b border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-8 py-2.5 text-sm">
      <ArrowUpCircle size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
      <span className="min-w-0 flex-1">
        {status.autoInstallFailed ? (
          <>
            <strong>EduBoard {version} is ready,</strong> but installing it automatically didn’t
            finish. Install it from Settings.
          </>
        ) : (
          <>
            <strong>EduBoard {version} is ready.</strong> It installs the next time you open
            EduBoard.
          </>
        )}
      </span>
      <Link
        to="/settings?section=updates"
        className="font-medium text-[var(--color-primary)] hover:underline"
      >
        {status.autoInstallFailed ? 'Install now' : 'Restart and update now'}
      </Link>
      <button
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        onClick={() => setHiddenFor(version)}
      >
        Later
      </button>
    </div>
  )
}
