import { useMemo, useState } from 'react'
import { BookOpenCheck, CheckCircle2, ShieldCheck, Upload, XCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Select } from '@renderer/components/ui/Field'
import { useClasses } from '@renderer/lib/queries'
import type { CoursePackInstallSummary, CoursePackPreview } from '@shared/coursePack'
import { tr } from '@shared/i18n'

const countLabels: [keyof CoursePackPreview['counts'], string][] = [
  ['lessons', 'lessons'],
  ['assessments', 'assessments'],
  ['homework', 'homework'],
  ['standards', 'standards'],
  ['rubrics', 'rubrics'],
  ['resources', 'resources'],
  ['studentFields', 'student fields']
]

export function CoursePackPanel(): React.JSX.Element {
  const { data: classes } = useClasses()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<CoursePackPreview | null>(null)
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CoursePackInstallSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const mappedClassIds = useMemo(
    () => preview?.terms.map((term) => bindings[term.key]).filter(Boolean) ?? [],
    [preview, bindings]
  )
  const duplicateClass = new Set(mappedClassIds).size !== mappedClassIds.length
  const allMapped = !!preview && preview.terms.every((term) => Boolean(bindings[term.key]))

  async function choosePack(): Promise<void> {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const next = await window.api.coursePack.preview()
      if (!next) return
      setPreview(next)
      setBindings({})
    } catch (err) {
      setPreview(null)
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function install(): Promise<void> {
    if (!preview || !allMapped || duplicateClass) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const installed = await window.api.coursePack.apply(preview.filePath, bindings)
      setResult(installed)
      await queryClient.invalidateQueries()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <BookOpenCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Import a Course Pack')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          {tr(
            'Course Packs add reusable curriculum: terms, standards, rubrics, lesson plans, assessments, homework, resources and optional student fields. They do not change school branding or publish anything to students.'
          )}
        </p>

        <Button variant="secondary" onClick={choosePack} disabled={busy}>
          <Upload size={15} className="mr-1 inline" aria-hidden />
          {busy && !preview ? tr('Reading…') : tr('Choose Course Pack')}
        </Button>

        {preview && (
          <div className="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <div>
              <h3 className="font-semibold">{preview.name}</h3>
              {preview.description && (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{preview.description}</p>
              )}
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                {countLabels
                  .map(([key, label]) => `${preview.counts[key]} ${tr(label)}`)
                  .join(' · ')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{tr('Map each pack term to one class')}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'EduBoard only installs class-bound content into the classes you choose here. Use a different class for each term.'
                  )}
                </p>
              </div>
              {preview.terms.map((term) => (
                <FormRow
                  key={term.key}
                  label={term.name}
                  hint={[term.schoolYear, term.startDate, term.endDate].filter(Boolean).join(' · ')}
                >
                  <Select
                    value={bindings[term.key] ?? ''}
                    onChange={(event) =>
                      setBindings((current) => ({
                        ...current,
                        [term.key]: event.target.value
                      }))
                    }
                  >
                    <option value="">{tr('Choose a class…')}</option>
                    {(classes ?? []).map((cls) => (
                      <option
                        key={cls.id}
                        value={cls.id}
                        disabled={
                          mappedClassIds.includes(cls.id) && bindings[term.key] !== cls.id
                        }
                      >
                        {cls.name}
                      </option>
                    ))}
                  </Select>
                </FormRow>
              ))}
            </div>

            {duplicateClass && (
              <p className="flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
                <XCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
                {tr('Choose a different class for each Course Pack term.')}
              </p>
            )}

            <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <p className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
                {tr('EduBoard creates a backup immediately before installing the pack.')}
              </p>
              <Button
                variant="primary"
                onClick={install}
                disabled={busy || !allMapped || duplicateClass}
              >
                {busy ? tr('Installing…') : tr('Install Course Pack')}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={15} className="text-[var(--color-success)]" aria-hidden />
              {tr('Course Pack installed.')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {tr(
                'Created: {lessons} lessons, {assessments} assessments, {homework} homework, {resources} resources. Reused existing matching items where safe.',
                {
                  lessons: result.created.lessons,
                  assessments: result.created.assessments,
                  homework: result.created.homework,
                  resources: result.created.resources
                }
              )}
            </p>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-[var(--color-danger)]">
            <XCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
