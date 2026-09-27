import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

/** Shown instead of the whole app while password protection has it locked: when
 * EduBoard opens, after the teacher's chosen idle time, or when the computer locks. */
export function LockScreen({ retryInSeconds }: { retryInSeconds: number }): React.JSX.Element {
  const qc = useQueryClient()
  const [secret, setSecret] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!secret || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.security.unlock(secret)
      if (result.ok) {
        setSecret('')
        // Anything fetched while locked was refused; fetch it all again.
        await qc.resetQueries()
      } else {
        setError(
          result.retryInSeconds
            ? tr('Too many wrong tries. Wait {seconds} seconds, then try again.', {
                seconds: result.retryInSeconds
              })
            : useRecovery
              ? tr('That recovery key doesn’t match.')
              : tr('That password isn’t right.')
        )
      }
    } catch (err) {
      setError(ipcErrorMessage(err, tr('EduBoard couldn’t be unlocked.')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-bg)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
            <Lock size={17} aria-hidden />
          </div>
          <div>
            <h1 className="text-base font-semibold">{tr('EduBoard is locked')}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {tr('Your class data is protected with a password.')}
            </p>
          </div>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {useRecovery ? tr('Recovery key') : tr('Password')}
          </span>
          <Input
            type={useRecovery ? 'text' : 'password'}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={useRecovery ? tr('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX') : undefined}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </label>
        {(error || retryInSeconds > 0) && (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {error ?? tr('Wait {retryInSeconds} seconds, then try again.', { retryInSeconds })}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={!secret || busy}>
          {busy ? tr('Unlocking…') : tr('Unlock')}
        </Button>
        <button
          type="button"
          className="text-xs text-[var(--color-primary)] hover:underline"
          onClick={() => {
            setUseRecovery(!useRecovery)
            setSecret('')
            setError(null)
          }}
        >
          {useRecovery
            ? tr('Use my password instead')
            : tr('Forgot your password? Use your recovery key')}
        </button>
      </form>
    </div>
  )
}
