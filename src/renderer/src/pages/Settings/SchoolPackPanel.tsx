import { useState } from 'react'
import { Download, PackageOpen, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'

/** Settings → School pack: share the school's logo, colour, grading scale, terms and
 * lists with colleagues as one file, or take them from one. */
export function SchoolPackPanel(): React.JSX.Element {
  const qc = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ filePath: string; changes: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <PackageOpen size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('School pack')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'One file with your school’s name, logo, colour, grading scale, pass mark, terms, log buttons, student fields and stylesheet. Set EduBoard up once, export the pack, and colleagues import it to match. It contains no students or grades.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                const r = await window.api.schoolPack.export()
                setMessage(r.saved ? tr('Saved to {path}', { path: r.filePath }) : null)
              } catch (err) {
                setMessage(ipcErrorMessage(err, tr('The school pack couldn’t be saved.')))
              }
            }}
          >
            <Download size={13} className="mr-1 inline" aria-hidden />
            {tr('Export school pack')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setMessage(null)
              try {
                const p = await window.api.schoolPack.preview()
                if (p && !p.changes.length)
                  setMessage(tr('This computer already matches that pack.'))
                else setPreview(p)
              } catch (err) {
                setMessage(ipcErrorMessage(err, tr('That file couldn’t be read.')))
              }
            }}
          >
            <Upload size={13} className="mr-1 inline" aria-hidden />
            {tr('Import school pack…')}
          </Button>
        </div>
        {message && <p className="text-[var(--color-text-muted)]">{message}</p>}
      </CardBody>

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={tr('Import school pack?')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              {tr('Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                if (!preview) return
                setBusy(true)
                try {
                  const r = await window.api.schoolPack.apply(preview.filePath)
                  setMessage(
                    trn('Imported: {n} change.', 'Imported: {n} changes.', r.changes.length)
                  )
                  setPreview(null)
                  if (r.reload) location.reload()
                  await qc.invalidateQueries()
                } catch (err) {
                  setMessage(ipcErrorMessage(err, tr('The school pack couldn’t be imported.')))
                  setPreview(null)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {tr('Import')}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>{tr('This will change:')}</p>
          <ul className="list-disc space-y-1 pl-5">
            {preview?.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-[var(--color-text-muted)]">
            {tr(
              'Your classes, students and grades aren’t touched. Existing classes keep their own grading scale; terms and student fields are only added, never removed.'
            )}
          </p>
        </div>
      </Modal>
    </Card>
  )
}
