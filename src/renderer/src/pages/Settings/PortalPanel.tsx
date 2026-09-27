import { FormEvent, useState } from 'react'
import { KeyRound, Mail, UploadCloud, Wifi } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { ipcErrorMessage } from '@renderer/lib/format'
import {
  usePublishToPortal,
  usePullSubmissionsFromPortal,
  useResetPortalPassword,
  useSendDigestNow
} from '@renderer/lib/queries'
import { PublishSummary } from '@renderer/components/portal/PublishSummary'
import { tr, trn } from '@shared/i18n'

// No 0/O/1/l/I, so a temporary password read aloud or copied off a screen can't be
// mistyped. 10 characters from 56 symbols is about 58 bits: plenty for a password the
// student replaces on first login, and the Portal rate-limits guesses anyway.
const TEMP_PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join(
    ''
  )
}

export function PortalPanel(): React.JSX.Element {
  const publish = usePublishToPortal()
  const pull = usePullSubmissionsFromPortal()
  const sendDigest = useSendDigestNow()
  const resetPassword = useResetPortalPassword()
  const [resetUsername, setResetUsername] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')

  function handleReset(e: FormEvent): void {
    e.preventDefault()
    resetPassword.mutate({ username: resetUsername.trim(), newPassword: resetNewPassword })
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Wifi size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Portal sync')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pull.mutate()}
            disabled={pull.isPending}
          >
            {pull.isPending ? tr('Pulling…') : tr('Pull homework status')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
          >
            <UploadCloud size={14} className="mr-1 inline" aria-hidden />
            {publish.isPending ? tr('Publishing…') : tr('Publish to portal')}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-2 text-sm text-[var(--color-text-muted)]">
        <p>
          {tr(
            'Publish pushes your current roster, grades, attendance, homework, and invite codes to the Portal URL above. Pull brings back homework status students have set themselves — nothing else ever flows back into this app.'
          )}
        </p>
        <p>
          {tr(
            "This also happens automatically a couple seconds after you edit anything that shows on the Portal — grades, attendance, roster changes, homework — so this button is mainly for forcing an immediate sync or double-checking it's working."
          )}
        </p>
        {publish.isError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(publish.error, tr('Could not publish to the portal.'))}
          </p>
        )}
        {publish.isSuccess && <PublishSummary result={publish.data} />}
        {pull.isError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(pull.error, tr('Could not pull from the portal.'))}
          </p>
        )}
        {pull.isSuccess && (
          <p className="text-[var(--color-success)]">
            {trn('Pulled {data} submission.', 'Pulled {data} submissions.', pull.data, {
              data: pull.data
            })}
          </p>
        )}
        <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => sendDigest.mutate()}
            disabled={sendDigest.isPending}
          >
            <Mail size={14} className="mr-1 inline" aria-hidden />
            {sendDigest.isPending ? tr('Sending…') : tr('Send weekly digest now')}
          </Button>
          {sendDigest.isError && (
            <span className="text-[var(--color-danger)]">
              {ipcErrorMessage(sendDigest.error, tr('Could not send the digest.'))}
            </span>
          )}
          {sendDigest.isSuccess && (
            <span className="text-[var(--color-success)]">
              {tr('Sent to {sent} of {total} families with an email on file.', {
                sent: sendDigest.data.sent,
                total: sendDigest.data.total
              })}
            </span>
          )}
        </div>
        <form
          onSubmit={handleReset}
          className="space-y-2 border-t border-[var(--color-border)] pt-3"
        >
          <p className="flex items-center gap-1.5 font-medium text-[var(--color-text)]">
            <KeyRound size={14} aria-hidden />
            {tr("Reset a student's Portal password")}
          </p>
          <p>
            {tr(
              'For a student or family who is locked out. This signs them out everywhere and cancels their quick-login QR codes. Give them the new password, and they can change it under Account on the Portal.'
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-48"
              placeholder={tr('Portal username')}
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              required
            />
            <Input
              className="w-48"
              placeholder={tr('New password (8+ characters)')}
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setResetNewPassword(generateTempPassword())}
            >
              {tr('Generate')}
            </Button>
            <Button type="submit" size="sm" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? tr('Resetting…') : tr('Reset password')}
            </Button>
          </div>
          {resetPassword.isError && (
            <p className="text-[var(--color-danger)]">
              {ipcErrorMessage(resetPassword.error, tr('Could not reset the password.'))}
            </p>
          )}
          {resetPassword.isSuccess && (
            <p className="text-[var(--color-success)]">
              {tr('Password reset for {username}. Their other sessions are signed out.', {
                username: resetPassword.variables.username
              })}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  )
}
