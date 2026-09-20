import { UploadCloud, Wifi } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { ipcErrorMessage } from '@renderer/lib/format'
import { usePublishToPortal, usePullSubmissionsFromPortal } from '@renderer/lib/queries'

export function PortalPanel(): React.JSX.Element {
  const publish = usePublishToPortal()
  const pull = usePullSubmissionsFromPortal()

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
      </CardBody>
    </Card>
  )
}
