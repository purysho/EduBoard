import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, RefreshCw, Send } from 'lucide-react'
import type { ClassSection, ReportCardSendProgress, ReportCardSendResult } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input } from '@renderer/components/ui/Field'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useReportCardDeliveries,
  useSendReportCards,
  useSettings,
  useWithdrawReportCards
} from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'
import { tr, trn, uiLocale } from '@shared/i18n'

function defaultTitle(): string {
  const month = new Date().toLocaleDateString(uiLocale(), { month: 'long', year: 'numeric' })
  return tr('Report card, {month}', { month })
}

/** Report tab: send every student's report card privately to their family on the
 * Portal, and see who has opened it. */
export function PortalReportCards({
  classSection,
  studentCount
}: {
  classSection: ClassSection
  studentCount: number
}): React.JSX.Element {
  const { data: settings } = useSettings()
  const connected = !!settings?.portalUrl.trim() && !!settings?.portalSyncSecret.trim()
  const deliveries = useReportCardDeliveries(classSection.id, connected)
  const send = useSendReportCards(classSection.id)
  const withdraw = useWithdrawReportCards(classSection.id)

  const [title, setTitle] = useState(defaultTitle)
  const [confirming, setConfirming] = useState(false)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [progress, setProgress] = useState<ReportCardSendProgress | null>(null)
  const [result, setResult] = useState<ReportCardSendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A send takes about a second per student; show how far it has got.
  useEffect(() => {
    if (!send.isPending) return
    const timer = setInterval(() => {
      void window.api.reportCards.progress().then(setProgress)
    }, 500)
    return () => clearInterval(timer)
  }, [send.isPending])

  async function startSend(): Promise<void> {
    setConfirming(false)
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: studentCount })
    try {
      setResult(await send.mutateAsync(title))
    } catch (err) {
      setError(ipcErrorMessage(err, tr('The report cards couldn’t be sent.')))
    } finally {
      setProgress(null)
    }
  }

  const titleTaken = deliveries.data?.some((d) => d.title === title.trim().replace(/\s+/g, ' '))

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Send size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Send report cards to families')}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {tr(
            'Each family sees only their own child’s report card, on the Portal under Grades, and you see who has opened it. It’s the same PDF as Print PDF.'
          )}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {!connected ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr('Connect to your Portal first:')}{' '}
            <Link
              to="/settings?section=portal"
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              {tr('Settings → Portal and families')}
            </Link>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <FormRow
                  label={tr('Title families see')}
                  hint={
                    titleTaken
                      ? tr(
                          'Already sent with this title: sending again replaces those report cards.'
                        )
                      : tr('For example “End of Term 1 report”.')
                  }
                >
                  <Input
                    aria-label={tr('Title families see')}
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={send.isPending}
                  />
                </FormRow>
              </div>
              <Button
                variant="primary"
                className="mb-5"
                disabled={!title.trim() || !studentCount || send.isPending}
                onClick={() => setConfirming(true)}
              >
                <Send size={14} className="mr-1 inline" aria-hidden />
                {send.isPending
                  ? tr('Sending…')
                  : trn('Send {n} report card', 'Send {n} report cards', studentCount)}
              </Button>
            </div>

            {progress && (
              <div role="status" className="space-y-1">
                <p className="text-sm">
                  {tr('Making and sending report cards: {done} of {total}…', {
                    done: progress.done,
                    total: progress.total
                  })}
                </p>
                <div className="h-1.5 overflow-hidden rounded bg-[var(--color-surface-muted)]">
                  <div
                    className="h-full bg-[var(--color-primary)] transition-all"
                    style={{
                      width: `${progress.total ? (100 * progress.done) / progress.total : 0}%`
                    }}
                  />
                </div>
              </div>
            )}
            {result && (
              <div
                role="status"
                className="rounded-md bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {trn('{n} report card sent.', '{n} report cards sent.', result.sent)}
                {result.failed.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-[var(--color-danger)]">
                    {result.failed.map((f) => (
                      <li key={f.name}>
                        {f.name}: {f.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-medium">{tr('Sent so far')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deliveries.refetch()}
                  disabled={deliveries.isFetching}
                >
                  <RefreshCw size={13} className="mr-1 inline" aria-hidden />
                  {tr('Refresh')}
                </Button>
              </div>
              {deliveries.isError ? (
                <p className="text-sm text-[var(--color-danger)]">
                  {ipcErrorMessage(deliveries.error, tr('Couldn’t reach the Portal.'))}
                </p>
              ) : !deliveries.data?.length ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {deliveries.isLoading ? tr('Loading…') : tr('None sent to this class yet.')}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-sm">
                  {deliveries.data.map((d) => {
                    const notSeen = d.students.filter((s) => s.hasLogin && !s.seenAt)
                    const noLogin = d.students.filter((s) => !s.hasLogin)
                    const expanded = open === d.title
                    return (
                      <li key={d.title} className="py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <button
                            type="button"
                            className="flex items-center gap-1 font-medium"
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : d.title)}
                          >
                            {expanded ? (
                              <ChevronDown size={14} aria-hidden />
                            ) : (
                              <ChevronRight size={14} aria-hidden />
                            )}
                            {d.title}
                          </button>
                          <span className="text-[var(--color-text-muted)]">
                            {formatDate(d.sentAt)}
                          </span>
                          <span>
                            {tr('Opened by {seen} of {audience} families', {
                              seen: d.seenCount,
                              audience: d.audience
                            })}
                          </span>
                          {noLogin.length > 0 && (
                            <span className="text-[var(--color-text-muted)]">
                              {trn(
                                '{n} student has no Portal login yet',
                                '{n} students have no Portal login yet',
                                noLogin.length
                              )}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                            onClick={() => setWithdrawing(d.title)}
                          >
                            {tr('Withdraw')}
                          </Button>
                        </div>
                        {expanded && (
                          <div className="mt-2 space-y-1 pl-5 text-[var(--color-text-muted)]">
                            <p>
                              <strong className="text-[var(--color-text)]">
                                {tr('Not opened yet:')}
                              </strong>{' '}
                              {notSeen.length ? notSeen.map((s) => s.name).join(', ') : tr('none')}
                            </p>
                            {noLogin.length > 0 && (
                              <p>
                                <strong className="text-[var(--color-text)]">
                                  {tr('No Portal login yet:')}
                                </strong>{' '}
                                {noLogin.map((s) => s.name).join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirming}
        title={trn(
          'Send {n} report card to families?',
          'Send {n} report cards to families?',
          studentCount
        )}
        message={tr(
          'Each student’s report card goes to their own family on the Portal as “{title}”. Check the report comments first. Sending the same title again replaces them.',
          { title: title.trim() }
        )}
        confirmLabel={tr('Send')}
        onConfirm={() => void startSend()}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        open={withdrawing !== null}
        danger
        title={tr('Withdraw “{title}”?', { title: withdrawing ?? '' })}
        message={tr(
          'Families will no longer see these report cards on the Portal. Anyone who already downloaded one keeps their copy.'
        )}
        confirmLabel={tr('Withdraw')}
        onConfirm={() => {
          if (withdrawing) withdraw.mutate(withdrawing)
          setWithdrawing(null)
        }}
        onCancel={() => setWithdrawing(null)}
      />
    </Card>
  )
}
