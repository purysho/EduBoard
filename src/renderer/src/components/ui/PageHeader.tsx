import { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  leading
}: {
  title: string
  description?: string
  actions?: ReactNode
  leading?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {leading}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
