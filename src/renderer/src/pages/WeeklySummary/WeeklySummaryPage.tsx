import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Printer } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

/** The teacher's own weekly summary: every class at a glance, with what families never
 * see. Shown exactly as it prints and as it's emailed. */
export function WeeklySummaryPage(): React.JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['weeklySummary'],
    queryFn: () => window.api.weeklySummary.get(),
    staleTime: 0
  })
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div>
      <PageHeader
        title={tr('Your week')}
        description={tr(
          'Every class at a glance: what was taught, what’s due, homework not handed in, students to check on and follow-ups owed.'
        )}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                const r = await window.api.weeklySummary.print()
                if (r.saved)
                  setMessage({ ok: true, text: tr('Saved to {path}', { path: r.filePath }) })
              }}
            >
              <Printer size={14} className="mr-1 inline" aria-hidden />
              {tr('Print (PDF)')}
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setMessage(null)
                try {
                  const to = await window.api.weeklySummary.email()
                  setMessage({ ok: true, text: tr('Sent to {email}.', { email: to }) })
                } catch (err) {
                  setMessage({
                    ok: false,
                    text: ipcErrorMessage(err, tr('Your summary couldn’t be emailed.'))
                  })
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Mail size={14} className="mr-1 inline" aria-hidden />
              {busy ? tr('Sending…') : tr('Email it to me')}
            </Button>
          </div>
        }
      />
      {message && (
        <p
          className={`mb-3 text-sm ${message.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
        >
          {message.text}
        </p>
      )}
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <Card>
          {/* Built in the main process from this computer's data, every value escaped. */}
          <CardBody>
            <div
              className="bg-white p-4 text-slate-900"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          </CardBody>
        </Card>
      )}
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {tr(
          'Emailing uses your Portal’s weekly digest email settings and sends only to your own address (Settings).'
        )}
      </p>
    </div>
  )
}

/** The same summary for printing to PDF. */
export function WeeklySummaryPrintPage(): React.JSX.Element {
  const { data } = useQuery({
    queryKey: ['weeklySummaryPrint'],
    queryFn: async () => {
      const r = await window.api.weeklySummary.get()
      // Tells the print window the page is ready to capture.
      setTimeout(() => (document.title = 'eduboard-print-ready'), 50)
      return r
    }
  })
  return (
    <div className="bg-white p-8 text-slate-900">
      {data && <div dangerouslySetInnerHTML={{ __html: data.html }} />}
    </div>
  )
}
