import { Mail, UploadCloud, Wifi } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { ipcErrorMessage } from '@renderer/lib/format'
import {
  usePublishToPortal,
  usePullSubmissionsFromPortal,
  useSendDigestNow
} from '@renderer/lib/queries'

export function PortalPanel(): React.JSX.Element {
  const publish = usePublishToPortal()
  const pull = usePullSubmissionsFromPortal()
  const sendDigest = useSendDigestNow()

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Wifi size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Portal sync
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => pull.mutate()}
            disabled={pull.isPending}
          >
            {pull.isPending ? 'Pulling…' : 'Pull homework status'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
          >
            <UploadCloud size={14} className="mr-1 inline" aria-hidden />
            {publish.isPending ? 'Publishing…' : 'Publish to portal'}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-2 text-sm text-[var(--color-text-muted)]">
        <p>
          Publish pushes your current roster, grades, attendance, homework, and invite codes to the
          Portal URL above. Pull brings back homework status students have set themselves — nothing
          else ever flows back into this app.
        </p>
        <p>
          This also happens automatically a couple seconds after you edit anything that shows on the
          Portal — grades, attendance, roster changes, homework — so this button is mainly for
          forcing an immediate sync or double-checking it&apos;s working.
        </p>
        {publish.isError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(publish.error, 'Could not publish to the portal.')}
          </p>
        )}
        {publish.isSuccess && <p className="text-[var(--color-success)]">Published.</p>}
        {pull.isError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(pull.error, 'Could not pull from the portal.')}
          </p>
        )}
        {pull.isSuccess && (
          <p className="text-[var(--color-success)]">
            Pulled {pull.data} submission{pull.data === 1 ? '' : 's'}.
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
            {sendDigest.isPending ? 'Sending…' : 'Send weekly digest now'}
          </Button>
          {sendDigest.isError && (
            <span className="text-[var(--color-danger)]">
              {ipcErrorMessage(sendDigest.error, 'Could not send the digest.')}
            </span>
          )}
          {sendDigest.isSuccess && (
            <span className="text-[var(--color-success)]">
              Sent to {sendDigest.data.sent} of {sendDigest.data.total} families with an email on
              file.
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
