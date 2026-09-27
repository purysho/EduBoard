import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

/** Exactly what each family would get in this week's digest, from the Portal. */
export function DigestPreviewModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { data, isLoading, error } = useQuery({
    queryKey: ['digestPreview'],
    queryFn: () => window.api.digest.preview(),
    staleTime: 0
  })
  const [index, setIndex] = useState(0)
  const family = data?.[index]

  return (
    <Modal
      open
      onClose={onClose}
      title={tr('This week’s digest')}
      wide
      footer={
        <Button variant="secondary" onClick={onClose}>
          {tr('Close')}
        </Button>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <p className="text-sm text-[var(--color-danger)]">
          {ipcErrorMessage(error, tr('Couldn’t reach the Portal. Try again.'))}
        </p>
      ) : !data?.length ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {tr('No families have a Portal account yet, so nobody would get a digest.')}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <select
              aria-label={tr('Family')}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            >
              {data.map((f, i) => (
                <option key={f.accountId} value={i}>
                  {f.students.join(', ') || f.username}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--color-text-muted)]">
              {family?.email
                ? tr('Goes to {email}', { email: family.email })
                : tr('No email on file, so this family gets nothing yet.')}
            </span>
          </div>
          <iframe
            title={tr('Digest preview')}
            className="h-[28rem] w-full rounded-md border border-[var(--color-border)] bg-white"
            sandbox=""
            srcDoc={family?.html ?? ''}
          />
        </div>
      )}
    </Modal>
  )
}
