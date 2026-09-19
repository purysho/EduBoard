import type { LucideIcon } from 'lucide-react'
import { Card, CardBody } from './Card'
import { cn } from '@renderer/lib/cn'

type Tone = 'primary' | 'success' | 'warning' | 'neutral'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary'
}: {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  tone?: Tone
}): React.JSX.Element {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              toneClasses[tone]
            )}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
          </div>
        )}
      </CardBody>
    </Card>
  )
}
