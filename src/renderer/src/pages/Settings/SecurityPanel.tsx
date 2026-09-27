import { useState } from 'react'
import { Copy, KeyRound, Lock, ShieldCheck, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import {
  useSecurityStatus,
  useSettings,
  useUnprotectedBackups,
  useUpdateSettings
} from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'

const MIN_LENGTH = 8
type Dialog = 'enable' | 'change' | 'disable' | null

/** Settings → Security: password protection (an encrypted database and a lock screen),
 * automatic locking, and removing backups made before protection was on. */
export function SecurityPanel(): React.JSX.Element {
  const qc = useQueryClient()
  const { data: status } = useSecurityStatus()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const isOn = !!status?.protected
  const { data: unprotected } = useUnprotectedBackups(isOn)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<number | null>(null)

  const refresh = (): void => {
    void qc.invalidateQueries({ queryKey: ['securityStatus'] })
    void qc.invalidateQueries({ queryKey: ['unprotectedBackups'] })
    void qc.invalidateQueries({ queryKey: ['backups'] })
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Password protection
        </h2>
        {isOn && (
          <Button variant="secondary" size="sm" onClick={() => void window.api.security.lock()}>
            <Lock size={13} className="mr-1 inline" aria-hidden />
            Lock now
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        {!isOn ? (
          <>
            <p className="text-[var(--color-text-muted)]">
              Encrypts your class data on this computer (or USB stick) so nobody can read it without
              your password, and asks for the password when EduBoard opens and after it has been
              left alone. Recommended if this computer is shared or leaves school.
            </p>
            <Button variant="primary" onClick={() => setDialog('enable')}>
              <KeyRound size={14} className="mr-1 inline" aria-hidden />
              Turn on password protection
            </Button>
          </>
        ) : (
          <>
            <p className="text-[var(--color-text-muted)]">
              On. Your data is encrypted, and EduBoard asks for your password when it opens.
            </p>
            {settings && (
              <label className="flex items-center gap-2">
                Lock after
                <select
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                  value={settings.autoLockMinutes}
                  onChange={(e) =>
                    updateSettings.mutate({ autoLockMinutes: Number(e.target.value) })
                  }
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={0}>never</option>
                </select>
                <span className="text-[var(--color-text-muted)]">
                  without the keyboard or mouse, and whenever the computer locks or sleeps.
                </span>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDialog('change')}>
                Change password
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDialog('disable')}>
                Turn off
              </Button>
            </div>
            {!!unprotected?.length && (
              <div className="rounded-lg border border-[var(--color-warning)] p-3">
                <p className="mb-2">
                  {unprotected.length} older{' '}
                  {unprotected.length === 1 ? 'backup was' : 'backups were'} made before protection
                  was on and can be read without your password.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    setDeleted(await window.api.security.deleteUnprotectedBackups())
                    refresh()
                  }}
                >
                  <Trash2 size={13} className="mr-1 inline" aria-hidden />
                  Delete unprotected backups
                </Button>
              </div>
            )}
            {deleted !== null && (
              <p className="text-[var(--color-text-muted)]">
                Deleted {deleted} unprotected {deleted === 1 ? 'backup' : 'backups'}.
              </p>
            )}
          </>
        )}
      </CardBody>

      <PasswordDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        onDone={(key) => {
          setDialog(null)
          if (key) setRecoveryKey(key)
          refresh()
        }}
      />
      <RecoveryKeyDialog recoveryKey={recoveryKey} onClose={() => setRecoveryKey(null)} />
    </Card>
  )
}

function PasswordDialog({
  mode,
  onClose,
  onDone
}: {
  mode: Dialog
  onClose: () => void
  onDone: (recoveryKey?: string) => void
}): React.JSX.Element {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const needsNew = mode === 'enable' || mode === 'change'
  const needsCurrent = mode === 'change' || mode === 'disable'
  const problem = needsNew
    ? next.length < MIN_LENGTH
      ? `Use at least ${MIN_LENGTH} characters.`
      : next !== again
        ? 'The two passwords don’t match.'
        : null
    : null
  const ready = !problem && (!needsCurrent || current.length > 0)

  function close(): void {
    setCurrent('')
    setNext('')
    setAgain('')
    setError(null)
    onClose()
  }

  async function submit(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'enable') {
        const { recoveryKey } = await window.api.security.enable(next)
        close()
        onDone(recoveryKey)
      } else if (mode === 'change') {
        await window.api.security.changePassword(current, next)
        close()
        onDone()
      } else if (mode === 'disable') {
        await window.api.security.disable(current)
        close()
        onDone()
      }
    } catch (err) {
      setError(ipcErrorMessage(err, 'That didn’t work. Nothing was changed.'))
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'enable'
      ? 'Turn on password protection'
      : mode === 'change'
        ? 'Change password'
        : 'Turn off password protection'

  return (
    <Modal
      open={mode !== null}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={mode === 'disable' ? 'danger' : 'primary'}
            disabled={!ready || busy}
            onClick={submit}
          >
            {busy
              ? 'Working…'
              : mode === 'disable'
                ? 'Turn off'
                : mode === 'enable'
                  ? 'Turn on'
                  : 'Change password'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready && !busy) void submit()
        }}
      >
        {mode === 'enable' && (
          <p className="text-sm text-[var(--color-text-muted)]">
            EduBoard backs up first, then encrypts your data. Next you’ll get a recovery key: the
            only way in if you forget this password.
          </p>
        )}
        {mode === 'disable' && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Your data will be stored without encryption again, and EduBoard won’t ask for a
            password.
          </p>
        )}
        {needsCurrent && (
          <FormRow label="Current password (or recovery key)">
            <Input
              type="password"
              autoFocus
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </FormRow>
        )}
        {needsNew && (
          <>
            <FormRow label="New password" hint={`At least ${MIN_LENGTH} characters.`}>
              <Input
                type="password"
                autoFocus={!needsCurrent}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </FormRow>
            <FormRow label="Type it again">
              <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} />
            </FormRow>
            {next.length > 0 && again.length > 0 && problem && (
              <p className="text-sm text-[var(--color-text-muted)]">{problem}</p>
            )}
          </>
        )}
        {error && (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function RecoveryKeyDialog({
  recoveryKey,
  onClose
}: {
  recoveryKey: string | null
  onClose: () => void
}): React.JSX.Element {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <Modal
      open={recoveryKey !== null}
      onClose={() => {
        if (saved) onClose()
      }}
      title="Your recovery key"
      footer={
        <Button
          variant="primary"
          disabled={!saved}
          onClick={() => {
            setSaved(false)
            setCopied(false)
            onClose()
          }}
        >
          Done
        </Button>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          Password protection is on. If you forget your password, this key is the{' '}
          <strong>only</strong> way to open your data. Nobody, including EduBoard, can recover it
          for you.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <code className="flex-1 font-mono text-base tracking-wide select-all">{recoveryKey}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(recoveryKey ?? '')
              setCopied(true)
            }}
          >
            <Copy size={13} className="mr-1 inline" aria-hidden />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-[var(--color-text-muted)]">
          Write it down or print it and keep it somewhere safe, away from this computer. It won’t be
          shown again.
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I’ve saved my recovery key somewhere safe
        </label>
      </div>
    </Modal>
  )
}
