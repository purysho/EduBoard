import { useState } from 'react'
import { Scale } from 'lucide-react'
import { gradeScaleIsValid } from '@shared/gradeScales'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input } from '@renderer/components/ui/Field'
import { GradeScaleEditor } from '@renderer/components/GradeScaleEditor'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

/** The grading scale and pass mark new classes start with (each class can change its own). */
export function GradingDefaultsPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState(settings?.defaultGradeThresholds ?? null)
  const [passMark, setPassMark] = useState(settings?.defaultPassMark ?? 60)
  const [seen, setSeen] = useState(settings)
  if (settings && settings !== seen) {
    setSeen(settings)
    setDraft(settings.defaultGradeThresholds)
    setPassMark(settings.defaultPassMark)
  }
  if (!settings || !draft) return null
  const changed =
    JSON.stringify(draft) !== JSON.stringify(settings.defaultGradeThresholds) ||
    passMark !== settings.defaultPassMark
  const passMarkOk = Number.isFinite(passMark) && passMark >= 0 && passMark <= 100
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Scale size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Grading scale for new classes')}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {tr('Existing classes keep their own scale; change one in its Settings tab.')}
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <GradeScaleEditor value={draft} onChange={setDraft} />
        <div className="max-w-xs">
          <FormRow
            label={tr('Default pass mark (%)')}
            hint={tr('Used when you create a new class')}
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
            />
          </FormRow>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={!changed || !gradeScaleIsValid(draft) || !passMarkOk || update.isPending}
          onClick={() =>
            update.mutate({ defaultGradeThresholds: draft, defaultPassMark: passMark })
          }
        >
          {tr('Save')}
        </Button>
      </CardBody>
    </Card>
  )
}
