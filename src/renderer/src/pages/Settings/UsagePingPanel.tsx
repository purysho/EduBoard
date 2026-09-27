import { useQuery } from '@tanstack/react-query'
import { HeartHandshake } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

/** Settings → Help improve EduBoard: the opt-in anonymous weekly ping, with exactly
 * what it sends shown underneath. */
export function UsagePingPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const on = settings?.usagePing === true
  const { data: preview } = useQuery({
    queryKey: ['usagePingPreview', on],
    queryFn: () => window.api.usagePing.preview()
  })
  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <HeartHandshake size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Help improve EduBoard')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={on}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ usagePing: e.target.checked })}
          />
          <span>
            {tr('Tell the EduBoard project, once a week, that this copy is still in use')}
            <span className="block text-xs text-[var(--color-text-muted)]">
              {tr(
                'Off unless you turn it on. It sends only what’s below: a random number made up on this computer, the version, the system and language, and roughly how many classes and students (as a range). Never names, your school, grades or anything a student wrote. Turning it off forgets the random number. Needs internet; nothing happens without it.'
              )}
            </span>
          </span>
        </label>
        {preview && (
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
              {on ? tr('What is sent each week') : tr('What would be sent')}
            </p>
            <pre className="overflow-x-auto rounded-md bg-[var(--color-surface-muted)] p-2 text-xs">
              {JSON.stringify(
                { ...preview, id: preview.id || tr('(made when you turn this on)') },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
