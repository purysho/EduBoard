import { Link } from 'react-router-dom'
import type { ClassSection } from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { formatPercent } from '@renderer/lib/format'
import { useClassReport, useClassRoster } from '@renderer/lib/queries'

const LEVEL_LABEL: Record<string, string> = {
  k12: 'K-12',
  university: 'University',
  club: 'Club',
  other: 'Other'
}

export function ClassCard({ classSection }: { classSection: ClassSection }): React.JSX.Element {
  const { data: roster } = useClassRoster(classSection.id)
  const { data: report } = useClassReport(classSection.id)

  return (
    <Link to={`/classes/${classSection.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <Badge tone="primary">
              {LEVEL_LABEL[classSection.levelType] ?? classSection.levelType}
            </Badge>
            {classSection.archived && <Badge>Archived</Badge>}
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text)]">{classSection.name}</h3>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {classSection.subject || classSection.gradeLevel || ' '}
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <span>{roster?.length ?? 0} students</span>
            <span>Avg {formatPercent(report?.averagePercent)}</span>
          </div>
        </CardBody>
      </Card>
    </Link>
  )
}
