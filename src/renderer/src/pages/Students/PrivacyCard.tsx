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
          Their data
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          If a student or their family asks what EduBoard holds about them, or asks for it to be
          removed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                const r = await window.api.students.exportData(student.id)
                setMessage(r.saved ? `Saved to ${r.filePath}` : null)
              } catch (err) {
                setMessage(ipcErrorMessage(err, 'Their data couldn’t be saved.'))
              }
            }}
          >
            <Download size={13} className="mr-1 inline" aria-hidden />
            Download their data
          </Button>
          <Button variant="danger" size="sm" onClick={() => setEraseOpen(true)}>
            <Eraser size={13} className="mr-1 inline" aria-hidden />
            Erase all their data…
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
      title={done ? 'Erased' : `Erase all of ${name}’s data?`}
      footer={
        done ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
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
                  setError(ipcErrorMessage(err, 'Nothing was erased.'))
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Erasing…' : 'Erase for good'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-2 text-sm">
          <p>Everything EduBoard held about {name} on this computer has been erased.</p>
          {done.portal === 'removed' && (
            <p>Their Portal login, handed-in work and profile have been removed too.</p>
          )}
          {done.portal === 'queued' && (
            <p className="text-[var(--color-warning)]">
              The Portal couldn’t be reached, so their Portal login and work will be removed the
              next time you publish.
            </p>
          )}
          {done.olderBackups > 0 && (
            <p className="text-[var(--color-text-muted)]">
              {done.olderBackups} {done.olderBackups === 1 ? 'backup' : 'backups'} made before now
              still include them. Automatic backups are replaced over time; delete the others from
              the backups folder (Settings → Backups → Open folder) if they must go now.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            This removes {name} and every record about them: enrollments, grades, attendance, notes,
            parent contacts, exit ticket answers, seats and their history in the audit log, and on
            the Portal their login, handed-in work, profile and Study Helper history.{' '}
            <strong>No backup is taken and it can’t be undone.</strong> Use{' '}
            <em>Download their data</em> first if they asked for a copy.
          </p>
          <p className="text-[var(--color-text-muted)]">
            If they had a Portal account, it and the work they handed in there stay on the Portal
            server; this erases what’s on this computer.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
              Type their name, {name}, to confirm
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
