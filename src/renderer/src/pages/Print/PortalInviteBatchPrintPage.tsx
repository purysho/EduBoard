import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useClasses, usePortalInviteBatch } from '@renderer/lib/queries'
import { Spinner } from '@renderer/components/ui/EmptyState'

export function PortalInviteBatchPrintPage(): React.JSX.Element {
  const { batchId } = useParams<{ batchId: string }>()
  const { data: batch, isLoading: batchLoading } = usePortalInviteBatch(batchId)
  const { data: classes, isLoading: classesLoading } = useClasses(true)
  const [qrByCode, setQrByCode] = useState<Record<string, string>>({})

  const classSection = classes?.find((c) => c.id === batch?.classId)
  const activeInvites = batch?.invites.filter((i) => !i.revoked) ?? []

  // QR codes are fetched once per invite, keyed by code — one-shot derived data, so
  // fetched here rather than a separate effect-per-invite.
  const [fetchedForBatch, setFetchedForBatch] = useState<string | null>(null)
  if (batch && fetchedForBatch !== batch.id) {
    setFetchedForBatch(batch.id)
    Promise.all(
      activeInvites.map(
        async (invite) =>
          [invite.code, await window.api.exitTickets.getQrDataUrl(invite.code)] as const
      )
    ).then((pairs) => setQrByCode(Object.fromEntries(pairs)))
  }

  const loading =
    batchLoading || classesLoading || Object.keys(qrByCode).length < activeInvites.length

  useEffect(() => {
    if (!loading && batch) {
      document.title = 'eduboard-print-ready'
    }
  }, [loading, batch])

  if (loading) return <Spinner />
  if (!batch) return <p className="p-8">Batch not available.</p>

  return (
    <div className="bg-white p-6 text-slate-900">
      <div className="grid grid-cols-3 gap-3">
        {activeInvites.map((invite, i) => (
          <div
            key={invite.id}
            className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3"
            style={{ pageBreakInside: 'avoid' }}
          >
            {qrByCode[invite.code] && (
              <img src={qrByCode[invite.code]} alt="" className="h-16 w-16 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase text-slate-500">{classSection?.name ?? 'Class'}</p>
              <p className="font-mono text-sm font-semibold">{invite.code}</p>
              <p className="text-[10px] text-slate-400">Portal invite #{i + 1}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
