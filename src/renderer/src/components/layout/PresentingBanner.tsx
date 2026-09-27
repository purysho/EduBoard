import { Projector } from 'lucide-react'
import { setPresenting, usePresenting } from '@renderer/lib/presenting'
import { tr } from '@shared/i18n'

export function PresentingBanner(): React.JSX.Element | null {
  const on = usePresenting()
  if (!on) return null
  return (
    <div className="no-print flex items-center gap-3 border-b border-[var(--color-warning)] bg-[var(--color-surface)] px-8 py-2 text-sm">
      <Projector size={16} className="shrink-0 text-[var(--color-warning)]" aria-hidden />
      <span className="min-w-0 flex-1">
        <strong>{tr('Presenting.')}</strong> {tr('Grades, notes and contact details are hidden.')}
      </span>
      <button
        className="font-medium text-[var(--color-primary)] hover:underline"
        onClick={() => setPresenting(false)}
      >
        {tr('Stop presenting')}
      </button>
    </div>
  )
}

export function HiddenWhilePresenting(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Projector size={32} className="mb-3 text-[var(--color-text-muted)]" aria-hidden />
      <h1 className="text-lg font-semibold">{tr('Hidden while presenting')}</h1>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">
        {tr('This page shows private details. Stop presenting to see it.')}
      </p>
    </div>
  )
}
