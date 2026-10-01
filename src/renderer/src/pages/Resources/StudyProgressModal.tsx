import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import type { LessonResource } from '@shared/types'
import type { StudyProgressReturn } from '@shared/studyProgress'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

export function StudyProgressModal({
  resource,
  onClose
}: {
  resource: LessonResource
  onClose: () => void
}): React.JSX.Element {
  const [rows, setRows] = useState<StudyProgressReturn[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    setRows(await window.api.lessonResources.listProgress(resource.id))
  }

  useEffect(() => {
    let active = true
    void window.api.lessonResources.listProgress(resource.id).then((next) => {
      if (active) setRows(next)
    })
    return () => {
      active = false
    }
  }, [resource.id])

  async function importFile(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const result = await window.api.lessonResources.importProgress(resource.id)
      if (result) {
        setMessage(tr('Imported progress for {name}.', { name: result.studentName }))
        await refresh()
      }
    } catch (error) {
      setMessage(ipcErrorMessage(error, tr('Could not import that progress file.')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={tr('Offline study progress')} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-muted)]">
          {tr(
            'Students can export a tiny JSON progress file from the Offline Study Pack. Importing it here does not require a student account, server or internet connection.'
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={importFile} disabled={busy}>
            <Upload size={13} className="mr-1 inline" aria-hidden />
            {busy ? tr('Importing…') : tr('Import progress file')}
          </Button>
          <span className="text-xs text-[var(--color-text-muted)]">
            {tr('For {title}', { title: resource.title })}
          </span>
        </div>

        {message && <p className="text-sm text-[var(--color-text-muted)]">{message}</p>}

        {!rows.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr('No returned progress files for this resource yet.')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-left text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2">{tr('Student')}</th>
                  <th className="px-3 py-2">{tr('Flashcards')}</th>
                  <th className="px-3 py-2">{tr('Quiz')}</th>
                  <th className="px-3 py-2">{tr('Exported')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.studentName}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {row.studentId ? tr('Matched to roster') : tr('Name only')}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {row.cards.total
                        ? tr('{got}/{total} got it', {
                            got: row.cards.got,
                            total: row.cards.total
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.quiz.total
                        ? tr('{correct}/{answered} correct ({total} total)', {
                            correct: row.quiz.correct,
                            answered: row.quiz.answered,
                            total: row.quiz.total
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                      {new Date(row.exportedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-[var(--color-text-muted)]">
          {tr('Returned files contain only the student-entered name and summary progress counts.')}
        </p>
      </div>
    </Modal>
  )
}
