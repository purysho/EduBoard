import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, RefreshCw, Sparkles } from 'lucide-react'
import type { AppUpdateProgress } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useAppUpdateInfo,
  useAppUpdateStatus,
  useSettings,
  useUpdateSettings
} from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr, uiLanguage } from '@shared/i18n'

const RELEASES_URL = 'https://github.com/purysho/EduBoard/releases/latest'
const SITE_URL = 'https://edu-board.com'

/** EduBoard's version, and updating it from right here. */
export function AboutPanel(): React.JSX.Element {
  const { data: info, refetch, isFetching } = useAppUpdateInfo()
  const { data: status } = useAppUpdateStatus()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const ready = status?.readyVersion ?? null
  // The sidebar's update icon and the banner link here.
  const location = useLocation()
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (new URLSearchParams(location.search).get('section') === 'updates') {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.search])
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
      setError(ipcErrorMessage(err, tr('The update didn’t work. Nothing was changed; try again.')))
    }
  }

  return (
    <div ref={cardRef} id="updates">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('EduBoard')} {info?.current ?? ''}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching || updating}
          >
            <RefreshCw size={13} className="mr-1 inline" aria-hidden />
            {isFetching ? tr('Checking…') : tr('Check for updates')}
          </Button>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          {!info ? null : updating ? (
            <div>
              <p className="mb-2">
                {progress?.phase === 'installing'
                  ? tr('Installing. EduBoard will close and reopen by itself in a moment…')
                  : tr('Downloading EduBoard {latest}… {round}%', {
                      latest: info.latest,
                      round: Math.round((progress?.fraction ?? 0) * 100)
                    })}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          ) : ready ? (
            <>
              <p>
                <strong>{tr('EduBoard {ready} is downloaded.', { ready })}</strong>{' '}
                {status?.autoInstallFailed
                  ? tr('Installing it automatically didn’t finish last time, so install it here.')
                  : settings?.autoUpdate
                    ? tr('It installs the next time you open EduBoard, or now if you restart.')
                    : tr('Restart to install it.')}
              </p>
              <Button variant="primary" onClick={() => setConfirming(true)}>
                <RefreshCw size={14} className="mr-1 inline" aria-hidden />
                {tr('Restart and update now')}
              </Button>
            </>
          ) : info.updateAvailable ? (
            <>
              <p>
                <strong>{tr('EduBoard {latest} is available.', { latest: info.latest })}</strong>
              </p>
              {info.canInstall ? (
                <Button variant="primary" onClick={() => setConfirming(true)}>
                  <Download size={14} className="mr-1 inline" aria-hidden />
                  {tr('Update now')}
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
                    {tr('Download it instead')}
                  </a>
                </p>
              )}
            </>
          ) : info.latest ? (
            <p className="text-[var(--color-text-muted)]">{tr('You have the newest version.')}</p>
          ) : (
            <p className="text-[var(--color-text-muted)]">
              {tr(
                'Couldn’t check for updates just now{problem}. Check your internet connection and try again.',
                { problem: info.problem ? ` (${info.problem})` : '' }
              )}
            </p>
          )}
          {error && <p className="text-[var(--color-danger)]">{error}</p>}
          {settings && (
            <label className="flex items-start gap-2 border-t border-[var(--color-border)] pt-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.autoUpdate}
                onChange={(e) => updateSettings.mutate({ autoUpdate: e.target.checked })}
              />
              <span>
                {tr('Install updates automatically')}
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'New versions download in the background and install the next time you open EduBoard, after a backup. Turn off to update only from here.'
                  )}
                </span>
              </span>
            </label>
          )}
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr('What EduBoard keeps and where:')}{' '}
            <a
              href={`${SITE_URL}/privacy?lang=${uiLanguage()}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-primary)] hover:underline"
            >
              {tr('Privacy notice')}
            </a>
            {' · '}
            <a
              href={`${SITE_URL}/data-processing?lang=${uiLanguage()}`}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-primary)] hover:underline"
            >
              {tr('Data processing terms for schools')}
            </a>
          </p>
        </CardBody>

        <ConfirmDialog
          open={confirming}
          title={tr('Update to EduBoard {version}?', { version: ready ?? info?.latest ?? '' })}
          message={
            ready
              ? tr(
                  'Save anything you’re working on first (a message or form you’re typing). EduBoard will take a backup, close, install the update and reopen by itself. Your classes, grades and all other data are kept.'
                )
              : tr(
                  'Save anything you’re working on first (a message or form you’re typing). EduBoard will take a backup, download the update, close, install it and reopen by itself. This takes a few minutes. Your classes, grades and all other data are kept.'
                )
          }
          confirmLabel={ready ? tr('Restart and update') : tr('Update now')}
          onConfirm={startUpdate}
          onCancel={() => setConfirming(false)}
        />
      </Card>
    </div>
  )
}
