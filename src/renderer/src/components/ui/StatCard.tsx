import { Card, CardBody } from './Card'

export function StatCard({
  label,
  value,
  hint
}: {
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
        {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
      </CardBody>
    </Card>
  )
}
