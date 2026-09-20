import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Printer, Ticket, Trash2 } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Input, Label } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import {
  useCreatePortalInviteBatch,
  usePortalInviteBatches,
  useRevokePortalInvite
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

export function PortalTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: batches, isLoading } = usePortalInviteBatches(classSection.id)
  const createBatch = useCreatePortalInviteBatch(classSection.id)
  const revokeInvite = useRevokePortalInvite(classSection.id)
  const [count, setCount] = useState(40)
  const [printing, setPrinting] = useState<string | null>(null)

  async function handlePrint(batchId: string): Promise<void> {
    setPrinting(batchId)
    try {
      await window.api.portalInvites.printBatch(
        batchId,
        `${classSection.name.replace(/[^\w -]/g, '')}-invites.pdf`
      )
    } finally {
      setPrinting(null)
    }
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-sm font-semibold">Generate Portal invites</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Each invite is a one-time code, pre-scoped to this class, ready to print and hand out as
            strips. The Portal itself isn&apos;t live yet — these are ready to go once it is.
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
              <Card key={batch.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {batch.count} invites — {formatDate(batch.createdAt)}
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
                      {printing === batch.id ? 'Printing…' : 'Print strips'}
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
