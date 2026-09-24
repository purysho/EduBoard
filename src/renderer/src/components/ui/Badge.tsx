import { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import type { Tone } from '@renderer/lib/grade'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
}

export function Badge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
