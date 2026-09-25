import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useSettings, useSetupProgress, useUpdateSettings } from '@renderer/lib/queries'
import { setupComplete, setupSteps } from '@shared/setupChecklist'

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
  const nextStep = steps.find((s) => !s.done && !s.optional)
  const hide = (): void => updateSettings.mutate({ onboardingDismissed: true })

  return (
    <Card className="mb-6">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} className="text-[var(--color-primary)]" aria-hidden />
            {complete ? "You're all set up" : 'Getting started'}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {complete
              ? 'Your class is live on the Portal. The optional extras below are there when you want them.'
              : `${doneCount} of ${essentials.length} essentials done. Each step ticks itself once it's done.`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={hide}>
          {complete ? 'Hide' : "I'll do this later"}
        </Button>
      </CardHeader>
      <CardBody className="pt-0">
        <div
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
          role="progressbar"
          aria-label="Setup progress"
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
                  aria-label="Done"
                />
              ) : (
                <Circle
                  size={18}
                  className="shrink-0 text-[var(--color-text-muted)]"
                  aria-label="Not done yet"
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
                  {step.optional && (
                    <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">
                      optional
                    </span>
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
