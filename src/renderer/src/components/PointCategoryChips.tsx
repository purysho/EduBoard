import { resolvePointCategories } from '@shared/pointCategories'
import { useSettings } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/cn'
import { tr } from '@shared/i18n'

/** "For: …" — the school's point categories as buttons, one chosen at a time (or none).
 * Used wherever a teacher gives class points. */
export function PointCategoryChips({
  value,
  onChange
}: {
  value: string | null
  onChange: (categoryId: string | null) => void
}): React.JSX.Element {
  const { data: settings } = useSettings()
  const categories = resolvePointCategories(settings?.pointCategories).filter((c) => !c.hidden)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-[var(--color-text-muted)]">{tr('For:')}</span>
      {[null, ...categories].map((c) => (
        <button
          key={c?.id ?? 'none'}
          aria-pressed={value === (c?.id ?? null)}
          className={cn(
            'rounded-full border px-2 py-0.5',
            value === (c?.id ?? null)
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
          )}
          onClick={() => onChange(c?.id ?? null)}
        >
          {c?.name ?? tr('No reason')}
        </button>
      ))}
    </div>
  )
}
