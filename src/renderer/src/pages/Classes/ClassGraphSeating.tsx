import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { ClassSection } from '@shared/types'
import type { ClassGraphSeatingPreview } from '@shared/classGraphHandback'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'

type Preview = ClassGraphSeatingPreview & { filePath: string }

/** Export the class to ClassGraph, and bring ClassGraph's approved seating back. Nothing
 * changes until the teacher has seen the preview and chosen "Replace seating chart". */
export function ClassGraphSeating({
  classSection
}: {
  classSection: ClassSection
}): React.JSX.Element {
  const qc = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [resizeGrid, setResizeGrid] = useState(false)
  const [busy, setBusy] = useState(false)

  const blocked = preview !== null && preview.unknownStudentIds.length > 0
  const needsResize = preview !== null && !preview.gridFits

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          setMessage(null)
          try {
            const r = await window.api.classGraph.exportClass(classSection.id)
            setMessage(r.saved ? tr('Saved to {path}', { path: r.filePath }) : null)
          } catch (err) {
            setMessage(ipcErrorMessage(err, tr('The class couldn’t be exported for ClassGraph.')))
          }
        }}
      >
        <Download size={13} className="mr-1 inline" aria-hidden />
        {tr('Export for ClassGraph')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          setMessage(null)
          try {
            const p = await window.api.classGraph.previewSeating(classSection.id)
            setResizeGrid(false)
            setPreview(p)
          } catch (err) {
            setMessage(ipcErrorMessage(err, tr('That file couldn’t be read.')))
          }
        }}
      >
        <Upload size={13} className="mr-1 inline" aria-hidden />
        {tr('Import from ClassGraph…')}
      </Button>
      {message && (
        <p className="basis-full text-xs text-[var(--color-text-muted)]" role="status">
          {message}
        </p>
      )}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={tr('Use ClassGraph’s seating plan?')}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              {tr('Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busy || blocked || (needsResize && !resizeGrid)}
              onClick={async () => {
                if (!preview) return
                setBusy(true)
                try {
                  const r = await window.api.classGraph.applySeating(
                    classSection.id,
                    preview.filePath,
                    resizeGrid
                  )
                  setMessage(
                    trn(
                      'Seating replaced: {n} student seated from ClassGraph.',
                      'Seating replaced: {n} students seated from ClassGraph.',
                      r.seated
                    )
                  )
                  setPreview(null)
                  await qc.invalidateQueries({ queryKey: ['classes'] })
                } catch (err) {
                  setMessage(ipcErrorMessage(err, tr('The seating plan couldn’t be imported.')))
                  setPreview(null)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {tr('Replace seating chart')}
            </Button>
          </>
        }
      >
        {preview && (
          <div className="space-y-3 text-sm">
            <p>
              {tr('From ClassGraph class “{title}”, saved {date}.', {
                title: preview.projectTitle || tr('(untitled)'),
                date: new Date(preview.projectUpdatedAt).toLocaleString()
              })}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {trn(
                  '{n} student will be seated.',
                  '{n} students will be seated.',
                  preview.seats.length
                )}
              </li>
              {preview.currentSeatCount > 0 && (
                <li>
                  {trn(
                    'The {n} seat filled now will be replaced.',
                    'All {n} seats filled now will be replaced.',
                    preview.currentSeatCount
                  )}
                </li>
              )}
              {preview.unseatedAfter > 0 && (
                <li>
                  {trn(
                    '{n} student in this class isn’t in the plan and will be unseated.',
                    '{n} students in this class aren’t in the plan and will be unseated.',
                    preview.unseatedAfter
                  )}
                </li>
              )}
              {preview.unmappedSeatCount > 0 && (
                <li>
                  {trn(
                    '{n} ClassGraph seat has no grid position and is left out.',
                    '{n} ClassGraph seats have no grid position and are left out.',
                    preview.unmappedSeatCount
                  )}
                </li>
              )}
            </ul>

            {blocked && (
              <p className="rounded-md bg-[var(--color-danger-soft)] p-2 text-[var(--color-danger)]">
                {trn(
                  '{n} student in the plan isn’t in this class, so it can’t be used here. Check the right class is open, or export the class to ClassGraph again so the students match. (EB-2010)',
                  '{n} students in the plan aren’t in this class, so it can’t be used here. Check the right class is open, or export the class to ClassGraph again so the students match. (EB-2010)',
                  preview.unknownStudentIds.length
                )}
              </p>
            )}

            {needsResize && !blocked && (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={resizeGrid}
                  onChange={(e) => setResizeGrid(e.target.checked)}
                />
                <span>
                  {tr(
                    'The plan needs a {rows} × {cols} grid. Enlarge this class’s seating grid to fit it.',
                    { rows: preview.gridNeeded.rows, cols: preview.gridNeeded.cols }
                  )}
                </span>
              </label>
            )}

            {!blocked && preview.seats.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-[var(--color-border)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)]">
                      <th className="px-2 py-1">{tr('Student')}</th>
                      <th className="px-2 py-1">{tr('Row')}</th>
                      <th className="px-2 py-1">{tr('Seat')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.seats.map((seat) => (
                      <tr key={seat.studentId} className="border-t border-[var(--color-border)]">
                        <td className="px-2 py-1">{seat.name}</td>
                        <td className="px-2 py-1">{seat.row + 1}</td>
                        <td className="px-2 py-1">{seat.col + 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-[var(--color-text-muted)]">
              {tr(
                'Only seats come back from ClassGraph. Grades, attendance and student details aren’t changed.'
              )}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
