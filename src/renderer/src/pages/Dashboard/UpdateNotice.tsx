import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useUpdateCheck } from '@renderer/lib/queries'
import { UpdateMessage } from '@renderer/pages/Settings/AboutPanel'

const DISMISSED_KEY = 'eduboard.updateNoticeDismissed'

function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/** Tells the teacher when their Portal announces a newer EduBoard. Dismissing hides it
 * until the next version after that. */
export function UpdateNotice(): React.JSX.Element | null {
  const { data: check } = useUpdateCheck()
  const [dismissed, setDismissed] = useState(dismissedVersion)
  if (!check?.updateAvailable || !check.latest || dismissed === check.latest) return null
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <Sparkles size={16} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <UpdateMessage latest={check.latest} downloadUrl={check.downloadUrl} />
      </div>
      <button
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED_KEY, check.latest!)
          } catch {
            // Not remembered; it shows again next time.
          }
          setDismissed(check.latest)
        }}
      >
        Not now
      </button>
    </div>
  )
}
