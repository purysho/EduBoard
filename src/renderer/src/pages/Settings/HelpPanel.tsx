import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, FolderOpen, LifeBuoy } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { formatDate } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

/** Settings → Help: recent errors with their codes, and the error report to send to
 * whoever supports EduBoard. */
export function HelpPanel(): React.JSX.Element {
  const { data: recent } = useQuery({
    queryKey: ['errorReport', 'recent'],
    queryFn: () => window.api.errorReport.recent(),
    staleTime: 0
  })
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <LifeBuoy size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Help')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'Every error message ends with a code such as EB-1003. When you ask for help, give the code, or copy the error report below and send it. The report has EduBoard’s version, your system and the recent errors; read it before you send it.'
          )}
        </p>
        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
            {recent.map((e, i) => (
              <li key={i} className="flex gap-3 px-3 py-2 text-xs">
                <span className="w-32 shrink-0 text-[var(--color-text-muted)]">
                  {formatDate(e.at, 'MMM d, p')}
                </span>
                <span className="w-28 shrink-0 select-all font-mono">
                  {e.code}
                  {e.ref ? ` · ${e.ref}` : ''}
                </span>
                <span className="min-w-0 flex-1 break-words">{e.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">{tr('No errors so far.')}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(await window.api.errorReport.get())
                setCopied('yes')
              } catch {
                setCopied('no')
              }
            }}
          >
            <Copy size={13} className="mr-1 inline" aria-hidden />
            {tr('Copy error report')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.api.errorReport.openFolder()}>
            <FolderOpen size={13} className="mr-1 inline" aria-hidden />
            {tr('Show the log file')}
          </Button>
          {copied === 'yes' && (
            <span role="status" className="text-xs text-[var(--color-success)]">
              {tr('Copied. Paste it into a message or email.')}
            </span>
          )}
          {copied === 'no' && (
            <span role="status" className="text-xs text-[var(--color-danger)]">
              {tr('Couldn’t copy. Use “Show the log file” and send errors.log instead.')}
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
