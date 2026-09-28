import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Printer, Trash2 } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Spinner } from '@renderer/components/ui/EmptyState'
import {
  queryKeys,
  usePortalInviteBatches,
  usePublishStatus,
  usePublishToPortal,
  useRevokePortalInvite,
  useSettings
} from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'
import { PublishSummary } from '@renderer/components/portal/PublishSummary'
import { PortalNeeded } from '@renderer/components/PortalNeeded'
import { JoinLinksCard } from './JoinLinksCard'
import { tr } from '@shared/i18n'

export function PortalTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: batches, isLoading } = usePortalInviteBatches(classSection.id)
  const revokeInvite = useRevokePortalInvite(classSection.id)
  const publish = usePublishToPortal()
  const { data: publishStatus } = usePublishStatus()
  const qc = useQueryClient()
  const [printing, setPrinting] = useState<string | null>(null)
  const { data: settings } = useSettings()
  const connected = !!settings?.portalUrl.trim() && !!settings?.portalSyncSecret.trim()

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

  if (isLoading || !settings) return <Spinner />
  if (!connected) {
    return (
      <PortalNeeded
        what={tr(
          'Students and families sign in to see homework, grades and your messages. This tab gives them their join links.'
        )}
      />
    )
  }

  return (
    <div>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="text-sm font-semibold">{tr('Publish to Portal')}</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              'Pushes your current roster, grades, attendance, and homework for every class to the Portal — not just this one. Do this after making changes you want families to see.'
            )}
          </p>
        </CardHeader>
        <CardBody className="flex items-center gap-3">
          <Button variant="primary" onClick={() => publish.mutate()} disabled={publish.isPending}>
            {publish.isPending ? tr('Publishing…') : tr('Publish to portal')}
          </Button>
          {publishStatus?.configured && !publish.isPending && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {publishStatus.upToDate
                ? tr('Students see everything.')
                : tr('You have changes students can’t see yet.')}
            </span>
          )}
          {publish.isError && (
            <p className="text-xs text-[var(--color-danger)]">
              {ipcErrorMessage(publish.error, tr('Could not publish to the portal.'))}
            </p>
          )}
          {publish.isSuccess && <PublishSummary result={publish.data} />}
        </CardBody>
      </Card>

      <JoinLinksCard classSection={classSection} />

      {batches && batches.length > 0 && (
        <>
          <h3 className="mb-1 mt-6 text-sm font-semibold">{tr('Older printed invite strips')}</h3>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Codes from before join links. They still work once each, and now show a fill-in form instead of the class list. Revoke any you no longer need.'
            )}
          </p>
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
                        {tr('{count} invites — {date}', {
                          count: batch.count,
                          date: formatDate(batch.createdAt)
                        })}
                        {batch.printedAt && (
                          <Badge tone="success">
                            <Check size={11} className="mr-0.5 inline" aria-hidden />
                            {tr('Printed {date}', { date: formatDate(batch.printedAt) })}
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {tr('{active} active, {revoked} revoked', {
                          active: active.length,
                          revoked: batch.invites.length - active.length
                        })}
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
                          ? tr('Printing…')
                          : batch.printedAt
                            ? tr('Print again')
                            : tr('Print strips')}
                      </Button>
                      {active.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => active.forEach((i) => revokeInvite.mutate(i.id))}
                        >
                          <Trash2 size={13} className="mr-1 inline" aria-hidden />
                          {tr('Revoke all')}
                        </Button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
