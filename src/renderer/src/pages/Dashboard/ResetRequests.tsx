import { KeyRound } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { useAnswerResetRequest, usePortalResetRequests } from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'

/** Students who asked for a new password from the Portal's login page. Approving lets
 * them choose one on the device they asked from; nobody has to type or pass on a
 * temporary password. */
export function ResetRequests(): React.JSX.Element | null {
  const { data: requests } = usePortalResetRequests()
  const answer = useAnswerResetRequest()
  if (!requests?.length) return null

  return (
    <div className="mb-6 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] px-4 py-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <KeyRound size={15} aria-hidden /> Forgotten Portal passwords
      </p>
      <p className="mb-2 text-[var(--color-text-muted)]">
        Approve only if the student really asked you (in class, or by message). They then choose a
        new password on the device they asked from.
      </p>
      <ul className="divide-y divide-[var(--color-border)]">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <strong>{r.studentNames.join(', ') || r.username}</strong>{' '}
              <span className="text-[var(--color-text-muted)]">
                · username {r.username} · asked {formatDate(r.requestedAt, 'MMM d, p')}
              </span>
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ id: r.id, approve: true })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={answer.isPending}
              onClick={() => answer.mutate({ id: r.id, approve: false })}
            >
              Decline
            </Button>
          </li>
        ))}
      </ul>
      {answer.isError && (
        <p className="mt-2 text-[var(--color-danger)]">
          {ipcErrorMessage(answer.error, 'Couldn’t reach the Portal. Try again.')}
        </p>
      )}
    </div>
  )
}
