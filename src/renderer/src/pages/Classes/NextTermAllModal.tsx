import { useMemo, useState } from 'react'
import type { ClassSection, Term } from '@shared/types'
import type { StartNextTermForClassesResult } from '@shared/inputs'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Select } from '@renderer/components/ui/Field'
import { useStartNextTerm, useTerms } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'

const NO_TERM = ''
const termLabel = (t: Term | undefined): string =>
  t ? `${t.name}${t.schoolYear ? ` · ${t.schoolYear}` : ''}` : tr('No term')

/** The term most current classes are in: the likely one that's ending. */
function busiestTerm(classes: ClassSection[]): string {
  const counts = new Map<string, number>()
  for (const c of classes)
    counts.set(c.termId ?? NO_TERM, (counts.get(c.termId ?? NO_TERM) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NO_TERM
}

/**
 * The end-of-term step for every class at once (Classes → Start next term): pick the
 * term that's ending and the one that's next, tick the classes that carry on, and each
 * gets a next-term class with the same setup, students and timetable.
 */
export function NextTermAllModal({
  open,
  onClose,
  classes
}: {
  open: boolean
  onClose: () => void
  classes: ClassSection[]
}): React.JSX.Element {
  const { data: terms } = useTerms()
  const start = useStartNextTerm()
  const current = useMemo(() => classes.filter((c) => !c.archived), [classes])

  const [fromTerm, setFromTerm] = useState<string | null>(null)
  const from = fromTerm ?? busiestTerm(current)
  const fromIndex = (terms ?? []).findIndex((t) => t.id === from)
  const suggestedTo = fromIndex >= 0 ? (terms?.[fromIndex + 1]?.id ?? NO_TERM) : NO_TERM
  const [toTerm, setToTerm] = useState<string | null>(null)
  const to = toTerm ?? suggestedTo

  const inFrom = current.filter((c) => (c.termId ?? NO_TERM) === from)
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const chosen = inFrom.filter((c) => !unticked.has(c.id))
  const [copyStudents, setCopyStudents] = useState(true)
  const [copyTimetable, setCopyTimetable] = useState(true)
  const [archiveOld, setArchiveOld] = useState(false)
  const [result, setResult] = useState<StartNextTermForClassesResult | null>(null)

  const termsInUse = [...new Set(current.map((c) => c.termId ?? NO_TERM))]
  const sameTerm = from === to

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('Start the next term for your classes')}
      wide
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            {tr('Done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {tr('Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!chosen.length || sameTerm || start.isPending}
              onClick={async () => {
                setResult(
                  await start.mutateAsync({
                    classIds: chosen.map((c) => c.id),
                    termId: to || null,
                    copyStudents,
                    copyTimetable,
                    archiveOld
                  })
                )
              }}
            >
              {start.isPending
                ? tr('Creating…')
                : trn('Create {n} class', 'Create {n} classes', chosen.length)}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            {trn(
              'Made {created} class for {termLabel}.',
              'Made {created} classes for {termLabel}.',
              result.created,
              { created: result.created, termLabel: termLabel(terms?.find((t) => t.id === to)) }
            )}
            {archiveOld && result.created > 0 && ' ' + tr('The old classes are archived.')}
          </p>
          {result.skipped.length > 0 && (
            <p className="text-[var(--color-text-muted)]">
              {tr('Already there, so left alone: {join}.', { join: result.skipped.join(', ') })}
            </p>
          )}
          {copyStudents && result.created > 0 && (
            <p className="text-[var(--color-text-muted)]">
              {tr(
                'Students keep their Portal logins; the new classes appear for them after you publish.'
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <FormRow label={tr('Ending term')}>
              <Select
                value={from}
                onChange={(e) => {
                  setFromTerm(e.target.value)
                  setToTerm(null)
                  setUnticked(new Set())
                }}
              >
                {termsInUse.map((id) => (
                  <option key={id} value={id}>
                    {termLabel(terms?.find((t) => t.id === id))}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow
              label={tr('Next term')}
              hint={
                sameTerm
                  ? tr('Choose a different term from the one ending.')
                  : terms?.length
                    ? undefined
                    : tr('No terms yet. Add them in Settings → Terms.')
              }
            >
              <Select value={to} onChange={(e) => setToTerm(e.target.value)}>
                <option value={NO_TERM}>{tr('No term')}</option>
                {(terms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {termLabel(t)}
                  </option>
                ))}
              </Select>
            </FormRow>
          </div>

          <fieldset>
            <legend className="mb-1 font-medium">{tr('Classes that carry on')}</legend>
            <div className="max-h-56 space-y-1 overflow-auto rounded-md border border-[var(--color-border)] p-2">
              {inFrom.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!unticked.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(unticked)
                      if (e.target.checked) next.delete(c.id)
                      else next.add(c.id)
                      setUnticked(next)
                    }}
                  />
                  {c.name}
                </label>
              ))}
              {!inFrom.length && (
                <p className="text-[var(--color-text-muted)]">
                  {tr('No current classes in this term.')}
                </p>
              )}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={copyStudents}
                onChange={(e) => setCopyStudents(e.target.checked)}
              />
              <span>
                {tr('Bring the students across')}
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {tr('Same student records, so Portal logins keep working.')}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={copyTimetable}
                onChange={(e) => setCopyTimetable(e.target.checked)}
              />
              {tr('Keep the same timetable')}
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={archiveOld}
                onChange={(e) => setArchiveOld(e.target.checked)}
              />
              <span>
                {tr('Archive the old classes')}
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'Their grades and attendance stay (Classes → Show archived), and students still see them read-only on the Portal.'
                  )}
                </span>
              </span>
            </label>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              "Each new class gets the old one's name, grading scale and categories. Grades, attendance and homework stay with the old class. A backup is taken first."
            )}
          </p>
          {start.isError && (
            <p className="text-[var(--color-danger)]">
              {ipcErrorMessage(start.error, tr('No classes were created.'))}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
