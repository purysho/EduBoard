import { useState } from 'react'
import { Scale } from 'lucide-react'
import { gradeScaleIsValid } from '@shared/gradeScales'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { GradeScaleEditor } from '@renderer/components/GradeScaleEditor'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

/** The grading scale new classes start with (each class can change its own). */
export function GradingDefaultsPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState(settings?.defaultGradeThresholds ?? null)
  const [seen, setSeen] = useState(settings)
  if (settings && settings !== seen) {
    setSeen(settings)
    setDraft(settings.defaultGradeThresholds)
  }
  if (!settings || !draft) return null
  const changed = JSON.stringify(draft) !== JSON.stringify(settings.defaultGradeThresholds)
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Scale size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Grading scale for new classes')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <GradeScaleEditor value={draft} onChange={setDraft} />
        <Button
          variant="primary"
          size="sm"
          disabled={!changed || !gradeScaleIsValid(draft) || update.isPending}
          onClick={() => update.mutate({ defaultGradeThresholds: draft })}
        >
          {tr('Save')}
        </Button>
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr('Existing classes keep their own scale; change one in its Settings tab.')}
        </p>
      </CardBody>
    </Card>
  )
}
