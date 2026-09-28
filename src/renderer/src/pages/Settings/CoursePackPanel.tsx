import { useState } from 'react'
import { BookOpenCheck, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'
import type { ClassSection } from '@shared/types'

interface CoursePackPreview {
  filePath: string
  id: string
  name: string
  description: string | null
  subject: string | null
  terms: { key: string; name: string; schoolYear: string; startDate: string | null }[]
  counts: {
    standards: number
    rubrics: number
    assessments: number
    homework: number
    lessons: number
  }
}

/** Settings → Course Pack: reusable curriculum content that is installed only into the
 * existing classes the teacher explicitly chooses. It is intentionally separate from a
 * School Pack, which configures school-wide branding/settings. */
export function CoursePackPanel(): React.JSX.Element {
  const qc = useQueryClient()
  const [preview, setPreview] = useState<CoursePackPreview | null>(null)
  const [classes, setClasses] = useState<ClassSection[]>([])
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready =
    !!preview &&
    preview.terms.length > 0 &&
    preview.terms.every((term) => Boolean(bindings[term.key]))

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <BookOpenCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Course Pack')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'Import a reusable curriculum into classes you choose. A Course Pack can add terms, standards, rubrics, planned lessons, assessments and homework without changing EduBoard for other courses.'
          )}
        </p>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setMessage(null)
              try {
                const [pack, allClasses] = await Promise.all([
                  window.api.coursePack.preview(),
                  window.api.classes.list()
                ])
                if (!pack) return
                setClasses(allClasses.filter((cls) => !cls.archived))
                setBindings({})
                setPreview(pack)
              } catch (err) {
                setMessage(ipcErrorMessage(err, tr('That Course Pack couldn’t be read.')))
              }
            }}
          >
            <Upload size={13} className="mr-1 inline" aria-hidden />
            {tr('Import Course Pack…')}
          </Button>
        </div>
        {message && <p className="text-[var(--color-text-muted)]">{message}</p>}
      </CardBody>

      <Modal
        open={preview !== null}
        onClose={() => {
          if (!busy) setPreview(null)
        }}
        title={preview ? tr('Import {name}?', { name: preview.name }) : tr('Import Course Pack?')}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setPreview(null)}>
              {tr('Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busy || !ready}
              onClick={async () => {
                if (!preview || !ready) return
                setBusy(true)
                try {
                  const result = await window.api.coursePack.apply(preview.filePath, bindings)
                  const created = Object.values(result.created).reduce((sum, n) => sum + n, 0)
                  const reused = Object.values(result.reused).reduce((sum, n) => sum + n, 0)
                  setMessage(
                    tr('Course Pack imported: {created} added, {reused} already present.', {
                      created,
                      reused
                    })
                  )
                  setPreview(null)
                  await qc.invalidateQueries()
                } catch (err) {
                  setMessage(ipcErrorMessage(err, tr('The Course Pack couldn’t be imported.')))
                  setPreview(null)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? tr('Importing…') : tr('Import')}
            </Button>
          </>
        }
      >
        {preview && (
          <div className="space-y-4 text-sm">
            {preview.description && (
              <p className="text-[var(--color-text-muted)]">{preview.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                [tr('Standards'), preview.counts.standards],
                [tr('Rubrics'), preview.counts.rubrics],
                [tr('Assessments'), preview.counts.assessments],
                [tr('Homework'), preview.counts.homework],
                [tr('Lessons'), preview.counts.lessons]
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-2 text-center"
                >
                  <div className="text-base font-semibold">{value}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-medium">{tr('Choose the class for each term')}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'Only these classes will receive the pack. Existing students and grades are kept.'
                  )}
                </p>
              </div>

              {preview.terms.map((term) => (
                <label key={term.key} className="block space-y-1">
                  <span className="block text-xs font-medium">
                    {term.name} · {term.schoolYear}
                  </span>
                  <select
                    value={bindings[term.key] ?? ''}
                    onChange={(event) =>
                      setBindings((current) => ({
                        ...current,
                        [term.key]: event.target.value
                      }))
                    }
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-sm"
                  >
                    <option value="">{tr('Choose a class…')}</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.subject ? ` · ${cls.subject}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <p className="rounded-md bg-[var(--color-surface-muted)] p-2.5 text-xs text-[var(--color-text-muted)]">
              {tr(
                'EduBoard makes a backup immediately before importing. Re-importing the same pack reuses matching curriculum instead of creating duplicates.'
              )}
            </p>
          </div>
        )}
      </Modal>
    </Card>
  )
}
