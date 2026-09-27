import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Eraser, ShieldAlert } from 'lucide-react'
import type { Student } from '@shared/types'
import type { PortalRemoval } from '@shared/api'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { ipcErrorMessage, studentFullName } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'
import { trNodes } from '@renderer/lib/trNodes'

/** For a student's or family's data request: a copy of everything held about them, and
 * erasing it all for good. */
export function PrivacyCard({ student }: { student: Student }): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [eraseOpen, setEraseOpen] = useState(false)

  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldAlert size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Their data')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'If a student or their family asks what EduBoard holds about them, or asks for it to be removed.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                const r = await window.api.students.exportData(student.id)
                setMessage(r.saved ? tr('Saved to {path}', { path: r.filePath }) : null)
              } catch (err) {
                setMessage(ipcErrorMessage(err, tr('Their data couldn’t be saved.')))
              }
            }}
          >
            <Download size={13} className="mr-1 inline" aria-hidden />
            {tr('Download their data')}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setEraseOpen(true)}>
            <Eraser size={13} className="mr-1 inline" aria-hidden />
            {tr('Erase all their data…')}
          </Button>
        </div>
        {message && <p className="text-[var(--color-text-muted)]">{message}</p>}
      </CardBody>
      <EraseStudentModal student={student} open={eraseOpen} onClose={() => setEraseOpen(false)} />
    </Card>
  )
}

function EraseStudentModal({
  student,
  open,
  onClose
}: {
  student: Student
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const name = studentFullName(student)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ olderBackups: number; portal: PortalRemoval } | null>(null)
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase()

  function close(): void {
    setTyped('')
    setError(null)
    if (done) {
      setDone(null)
      void qc.invalidateQueries()
      navigate('/students')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? tr('Erased') : tr('Erase all of {name}’s data?', { name })}
      footer={
        done ? (
          <Button variant="primary" onClick={close}>
            {tr('Done')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {tr('Cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!matches || busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  const r = await window.api.students.erase(student.id)
                  setDone({ olderBackups: r.olderBackups, portal: r.portal })
                } catch (err) {
                  setError(ipcErrorMessage(err, tr('Nothing was erased.')))
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? tr('Erasing…') : tr('Erase for good')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-2 text-sm">
          <p>
            {tr('Everything EduBoard held about {name} on this computer has been erased.', {
              name
            })}
          </p>
          {done.portal === 'removed' && (
            <p>{tr('Their Portal login, handed-in work and profile have been removed too.')}</p>
          )}
          {done.portal === 'queued' && (
            <p className="text-[var(--color-warning)]">
              {tr(
                'The Portal couldn’t be reached, so their Portal login and work will be removed the next time you publish.'
              )}
            </p>
          )}
          {done.olderBackups > 0 && (
            <p className="text-[var(--color-text-muted)]">
              {trn(
                '{olderBackups} backup made before now still include them. Automatic backups are replaced over time; delete the others from the backups folder (Settings → Data and security → Backups → Open folder) if they must go now.',
                '{olderBackups} backups made before now still include them. Automatic backups are replaced over time; delete the others from the backups folder (Settings → Data and security → Backups → Open folder) if they must go now.',
                done.olderBackups,
                { olderBackups: done.olderBackups }
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            {tr(
              'This removes {name} and every record about them: enrollments, grades, attendance, notes, parent contacts, exit ticket answers, seats and their history in the audit log, and on the Portal their login, handed-in work, profile and Study Helper history.',
              { name }
            )}{' '}
            <strong>{tr('No backup is taken and it can’t be undone.')}</strong>{' '}
            {trNodes('Use {download} first if they asked for a copy.', {
              download: <em>{tr('Download their data')}</em>
            })}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              {tr('Type their name, {name}, to confirm', { name })}
            </span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
          {error && (
            <p className="text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
