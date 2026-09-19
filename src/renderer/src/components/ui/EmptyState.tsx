import { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description?: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-6 py-14 text-center">
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>
      )}
      {action}
    </div>
  )
}

export function Spinner(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
    </div>
  )
}
