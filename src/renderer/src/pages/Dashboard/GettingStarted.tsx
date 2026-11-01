import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useSettings, useSetupProgress, useUpdateSettings } from '@renderer/lib/queries'
import { setupComplete, setupSteps } from '@shared/setupChecklist'
import { tr } from '@shared/i18n'

/** First-run guide on the Dashboard. Each step ticks itself from real data (see
 * setupChecklist.ts), links straight to where it's done, and the whole card can be
 * hidden, and brought back from Settings. */
export function GettingStarted(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const navigate = useNavigate()
  const dismissed = settings?.onboardingDismissed ?? true
  const { data: progress } = useSetupProgress({ enabled: !dismissed })
  if (dismissed || !progress) return null

  const steps = setupSteps(progress)
  const essentials = steps.filter((s) => !s.optional)
  const doneCount = essentials.filter((s) => s.done).length
  const complete = setupComplete(steps)
  // In a pilot, before any class exists: suggest the sample school before real data.
  const pilotStart = progress.pilotMode && progress.classCount === 0
  const nextStep = pilotStart
    ? undefined
    : (steps.find((s) => !s.done && !s.optional) ?? steps.find((s) => !s.done && s.recommended))
  const hide = (): void => updateSettings.mutate({ onboardingDismissed: true })

  return (
    <Card className="mb-6">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} className="text-[var(--color-primary)]" aria-hidden />
            {complete ? tr("You're all set up") : tr('Getting started')}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {complete
              ? progress.pilotMode
                ? tr(
                    'Your classes are ready, and they’re saved on this computer. The extras below are there when you want them.'
                  )
                : tr(
                    'Your class is live on the Portal. The optional extras below are there when you want them.'
                  )
              : tr(
                  "{doneCount} of {length} essentials done. Each step ticks itself once it's done.",
                  { doneCount, length: essentials.length }
                )}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={hide}>
          {complete ? tr('Hide') : tr("I'll do this later")}
        </Button>
      </CardHeader>
      <CardBody className="pt-0">
        {pilotStart && (
          <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
            <p className="font-medium">{tr('Start with the sample school')}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {tr(
                'Try EduBoard with made-up classes first. They’re kept apart from your own, and you can leave the sample school any time.'
              )}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void window.api.sampleSchool.open()}
              >
                {tr('Try it with the sample school')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate(steps[0].to)}>
                {tr('Use my real classes')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {tr(
                'Using real student data in a pilot needs your school’s approval first. Ask whoever runs the pilot at your school.'
              )}
            </p>
          </div>
        )}
        {!complete && !pilotStart && (
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            {tr('Want to look around first?')}{' '}
            <button
              type="button"
              className="font-medium text-[var(--color-primary)] hover:underline"
              onClick={() => void window.api.sampleSchool.open()}
            >
              {tr('Open the sample school')}
            </button>{' '}
            {tr('(made-up classes, kept apart from yours).')}
          </p>
        )}
        <div
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
          role="progressbar"
          aria-label={tr('Setup progress')}
          aria-valuemin={0}
          aria-valuemax={essentials.length}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${(doneCount / essentials.length) * 100}%` }}
          />
        </div>
        <ol className="divide-y divide-[var(--color-border)]">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3 py-2.5">
              {step.done ? (
                <CheckCircle2
                  size={18}
                  className="shrink-0 text-[var(--color-success)]"
                  aria-label={tr('Done')}
                />
              ) : (
                <Circle
                  size={18}
                  className="shrink-0 text-[var(--color-text-muted)]"
                  aria-label={tr('Not done yet')}
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={
                    step.done
                      ? 'text-sm text-[var(--color-text-muted)] line-through'
                      : 'text-sm font-medium'
                  }
                >
                  {step.title}
                  {step.recommended ? (
                    <span className="ml-1.5 text-xs font-medium text-[var(--color-warning)]">
                      {tr('recommended')}
                    </span>
                  ) : (
                    step.optional && (
                      <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">
                        {tr('optional')}
                      </span>
                    )
                  )}
                </p>
                {!step.done && (
                  <p className="text-xs text-[var(--color-text-muted)]">{step.description}</p>
                )}
              </div>
              {!step.done && (
                <Button
                  variant={step === nextStep ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => navigate(step.to)}
                >
                  {step.actionLabel}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}
