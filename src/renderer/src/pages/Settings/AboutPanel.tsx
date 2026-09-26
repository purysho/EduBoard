import { RefreshCw, Sparkles } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useUpdateCheck } from '@renderer/lib/queries'

export function AboutPanel(): React.JSX.Element {
  const { data: check, refetch, isFetching } = useUpdateCheck()
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          EduBoard {check?.current ?? ''}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={13} className="mr-1 inline" aria-hidden />
          {isFetching ? 'Checking…' : 'Check for updates'}
        </Button>
      </CardHeader>
      <CardBody className="text-sm">
        {!check ? null : check.updateAvailable ? (
          <UpdateMessage latest={check.latest!} downloadUrl={check.downloadUrl} />
        ) : check.latest ? (
          <p className="text-[var(--color-text-muted)]">You have the newest version.</p>
        ) : (
          <p className="text-[var(--color-text-muted)]">
            New versions are announced through your Portal, which couldn&apos;t be asked just now
            (or isn&apos;t set up yet).
          </p>
        )}
      </CardBody>
    </Card>
  )
}

/** Shared by Settings and the Dashboard notice. */
export function UpdateMessage({
  latest,
  downloadUrl
}: {
  latest: string
  downloadUrl: string
}): React.JSX.Element {
  return (
    <p>
      EduBoard {latest} is available.{' '}
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-[var(--color-primary)] hover:underline"
      >
        Download it
      </a>{' '}
      <span className="text-[var(--color-text-muted)]">
        (sign in to GitHub first). On Windows you can double-click Update-EduBoard.cmd instead. Your
        classes and data are kept either way.
      </span>
    </p>
  )
}
