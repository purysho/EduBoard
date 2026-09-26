import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAppUpdateInfo } from '@renderer/lib/queries'

const DISMISSED_KEY = 'eduboard.updateNoticeDismissed'

function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/** Tells the teacher a newer EduBoard is out; updating itself happens in Settings.
 * Dismissing hides it until the next version after that. */
export function UpdateNotice(): React.JSX.Element | null {
  const { data: info } = useAppUpdateInfo()
  const [dismissed, setDismissed] = useState(dismissedVersion)
  if (!info?.updateAvailable || !info.latest || dismissed === info.latest) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <Sparkles size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
      <span className="min-w-0 flex-1">EduBoard {info.latest} is available.</span>
      <Link to="/settings" className="font-medium text-[var(--color-primary)] hover:underline">
        Update in Settings
      </Link>
      <button
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED_KEY, info.latest!)
          } catch {
            // Not remembered; it shows again next time.
          }
          setDismissed(info.latest)
        }}
      >
        Not now
      </button>
    </div>
  )
}
