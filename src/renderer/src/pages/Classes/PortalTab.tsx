import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Printer, Ticket, Trash2 } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Input, Label } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import {
  queryKeys,
  useCreatePortalInviteBatch,
  usePortalInviteBatches,
  usePublishToPortal,
  useRevokePortalInvite
} from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'
import { PublishSummary } from '@renderer/components/portal/PublishSummary'

export function PortalTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: batches, isLoading } = usePortalInviteBatches(classSection.id)
  const createBatch = useCreatePortalInviteBatch(classSection.id)
  const revokeInvite = useRevokePortalInvite(classSection.id)
  const publish = usePublishToPortal()
  const qc = useQueryClient()
  const [count, setCount] = useState(40)
  const [printing, setPrinting] = useState<string | null>(null)

  async function handlePrint(batchId: string): Promise<void> {
    setPrinting(batchId)
    try {
      const result = await window.api.portalInvites.printBatch(
        batchId,
        `${classSection.name.replace(/[^\w -]/g, '')}-invites.pdf`
      )
      if (result.saved) {
        qc.invalidateQueries({ queryKey: queryKeys.portalInviteBatches(classSection.id) })
      }
    } finally {
      setPrinting(null)
    }
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-sm font-semibold">Publish to Portal</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Pushes your current roster, grades, attendance, and homework for every class to the
            Portal — not just this one. Do this after making changes you want families to see.
          </p>
        </CardHeader>
        <CardBody className="flex items-center gap-3">
          <Button variant="primary" onClick={() => publish.mutate()} disabled={publish.isPending}>
            {publish.isPending ? 'Publishing…' : 'Publish to portal'}
          </Button>
          {publish.isError && (
            <p className="text-xs text-[var(--color-danger)]">
              {ipcErrorMessage(publish.error, 'Could not publish to the portal.')}
            </p>
          )}
          {publish.isSuccess && <PublishSummary result={publish.data} />}
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-sm font-semibold">Generate Portal invites</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Each invite is a one-time code, pre-scoped to this class, ready to print and hand out as
            strips for a family to redeem on the Portal.
          </p>
        </CardHeader>
        <CardBody className="flex items-end gap-3">
          <div className="w-32">
            <Label>How many</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <Button
            variant="primary"
            onClick={() => createBatch.mutate(count)}
            disabled={count < 1 || createBatch.isPending}
          >
            {createBatch.isPending ? 'Generating…' : 'Generate batch'}
          </Button>
        </CardBody>
      </Card>

      {!batches?.length ? (
        <EmptyState
          icon={Ticket}
          title="No invite batches yet"
          description="Generate a batch above to print strips for this class."
        />
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const active = batch.invites.filter((i) => !i.revoked)
            return (
              <Card
                key={batch.id}
                className={batch.printedAt ? 'border-[var(--color-success)]/40' : undefined}
              >
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {batch.count} invites — {formatDate(batch.createdAt)}
                      {batch.printedAt && (
                        <Badge tone="success">
                          <Check size={11} className="mr-0.5 inline" aria-hidden />
                          Printed {formatDate(batch.printedAt)}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {active.length} active, {batch.invites.length - active.length} revoked
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePrint(batch.id)}
                      disabled={printing === batch.id}
                    >
                      <Printer size={13} className="mr-1 inline" aria-hidden />
                      {printing === batch.id
                        ? 'Printing…'
                        : batch.printedAt
                          ? 'Print again'
                          : 'Print strips'}
                    </Button>
                    {active.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => active.forEach((i) => revokeInvite.mutate(i.id))}
                      >
                        <Trash2 size={13} className="mr-1 inline" aria-hidden />
                        Revoke all
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
