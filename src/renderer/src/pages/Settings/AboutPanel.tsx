import { useEffect, useState } from 'react'
import { Download, RefreshCw, Sparkles } from 'lucide-react'
import type { AppUpdateProgress } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useAppUpdateInfo } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'

const RELEASES_URL = 'https://github.com/purysho/EduBoard/releases/latest'

/** EduBoard's version, and updating it from right here. */
export function AboutPanel(): React.JSX.Element {
  const { data: info, refetch, isFetching } = useAppUpdateInfo()
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const updating = progress?.phase === 'downloading' || progress?.phase === 'installing'

  // While an update runs, show how far the download has got.
  useEffect(() => {
    if (!updating) return
    const timer = setInterval(async () => {
      setProgress(await window.api.settings.appUpdateProgress())
    }, 500)
    return () => clearInterval(timer)
  }, [updating])

  async function startUpdate(): Promise<void> {
    setConfirming(false)
    setError(null)
    setProgress({ phase: 'downloading', fraction: 0, error: null })
    try {
      await window.api.settings.installAppUpdate()
      setProgress({ phase: 'installing', fraction: 1, error: null })
    } catch (err) {
      setProgress(null)
      setError(ipcErrorMessage(err, 'The update didn’t work. Nothing was changed; try again.'))
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          EduBoard {info?.current ?? ''}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching || updating}
        >
          <RefreshCw size={13} className="mr-1 inline" aria-hidden />
          {isFetching ? 'Checking…' : 'Check for updates'}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        {!info ? null : updating ? (
          <div>
            <p className="mb-2">
              {progress?.phase === 'installing'
                ? 'Installing. EduBoard will close and reopen by itself in a moment…'
                : `Downloading EduBoard ${info.latest}… ${Math.round((progress?.fraction ?? 0) * 100)}%`}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-full bg-[var(--color-primary)] transition-all"
                style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ) : info.updateAvailable ? (
          <>
            <p>
              <strong>EduBoard {info.latest} is available.</strong>
            </p>
            {info.canInstall ? (
              <Button variant="primary" onClick={() => setConfirming(true)}>
                <Download size={14} className="mr-1 inline" aria-hidden />
                Update now
              </Button>
            ) : (
              <p className="text-[var(--color-text-muted)]">
                {info.cannotInstallReason}{' '}
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Download it instead
                </a>
              </p>
            )}
          </>
        ) : info.latest ? (
          <p className="text-[var(--color-text-muted)]">You have the newest version.</p>
        ) : (
          <p className="text-[var(--color-text-muted)]">
            Couldn&apos;t check for updates just now{info.problem ? ` (${info.problem})` : ''}.
            Check your internet connection and try again.
          </p>
        )}
        {error && <p className="text-[var(--color-danger)]">{error}</p>}
      </CardBody>

      <ConfirmDialog
        open={confirming}
        title={`Update to EduBoard ${info?.latest ?? ''}?`}
        message="Save anything you're working on first (a message or form you're typing). EduBoard will take a backup, download the update, close, install it and reopen by itself. This takes a few minutes. Your classes, grades and all other data are kept."
        confirmLabel="Update now"
        onConfirm={startUpdate}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  )
}
