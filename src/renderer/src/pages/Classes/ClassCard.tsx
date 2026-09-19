import { Link } from 'react-router-dom'
import { Award, BookOpen, GraduationCap, Sparkles, Users } from 'lucide-react'
import type { ClassSection, LevelType } from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { formatPercent } from '@renderer/lib/format'
import { useClassReport, useClassRoster } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/cn'

const LEVEL_META: Record<LevelType, { label: string; icon: typeof GraduationCap; bar: string }> = {
  k12: { label: 'K-12', icon: BookOpen, bar: 'bg-[var(--color-primary)]' },
  university: { label: 'University', icon: GraduationCap, bar: 'bg-violet-500' },
  club: { label: 'Club', icon: Sparkles, bar: 'bg-amber-500' },
  other: { label: 'Other', icon: Award, bar: 'bg-slate-400' }
}

export function ClassCard({ classSection }: { classSection: ClassSection }): React.JSX.Element {
  const { data: roster } = useClassRoster(classSection.id)
  const { data: report } = useClassReport(classSection.id)
  const meta = LEVEL_META[classSection.levelType] ?? LEVEL_META.other

  return (
    <Link to={`/classes/${classSection.id}`}>
      <Card className="group h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-md">
        <div className={cn('h-1', meta.bar)} />
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="primary">
              <meta.icon size={12} className="mr-1 inline" aria-hidden />
              {meta.label}
            </Badge>
            {classSection.archived && <Badge>Archived</Badge>}
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
            {classSection.name}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {classSection.subject || classSection.gradeLevel || ' '}
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Users size={14} aria-hidden />
              {roster?.length ?? 0}
            </span>
            <span>Avg {formatPercent(report?.averagePercent)}</span>
          </div>
        </CardBody>
      </Card>
    </Link>
  )
}
