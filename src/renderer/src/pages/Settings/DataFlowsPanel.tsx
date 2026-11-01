// Settings → What leaves this computer: every way EduBoard can send something off this
// computer, from the one list in shared/dataFlows.ts (docs/DATA_FLOWS.md is written from
// the same list), the local-only pilot switch, and the pilot summary to send by hand.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileBarChart, Lock, Network, ShieldCheck, Users } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { useManagedBranding, useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { DATA_FLOWS, PILOT_TREATMENT_LABELS, type PilotTreatment } from '@shared/dataFlows'
import { PILOT_SUMMARY_FEATURES } from '@shared/pilotSummary'
import {
  SHARED_SCREEN_NAME_FORMATS,
  SHARED_SCREEN_NAME_LABELS,
  sharedScreenNameFormat
} from '@shared/sharedScreenNames'
import { tr } from '@shared/i18n'
import type { Tone } from '@renderer/lib/grade'

const TONE: Record<PilotTreatment, Tone> = {
  blocked: 'neutral',
  allowed: 'primary',
  askFirst: 'primary',
  localNetwork: 'primary'
}

export function PilotModeCard(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const { data: managed } = useManagedBranding()
  const update = useUpdateSettings()
  if (!settings) return null
  const on = settings.pilotMode === true
  const lockedBySchool = !!managed?.locked.includes('pilotMode')

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Local-only pilot')}
          {on && (
            <Badge tone="success" className="ml-1">
              {tr('On')}
            </Badge>
          )}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'In a local-only pilot, nothing about your classes or students goes to the internet, to EduBoard or to any outside company. The Portal, AI, the weekly email to families, group chats and the usage count are turned off, and EduBoard refuses them even if asked. EduBoard still checks for updates, which sends only its version number. While you have an exit ticket, QR check-in or the classroom screen open, the class list is shown to devices on the school Wi-Fi that have that session’s link, over plain http, with names as set under Names on shared screens.'
          )}
        </p>
        {lockedBySchool ? (
          <p className="flex items-start gap-2 rounded-md bg-[var(--color-primary-soft)] px-3 py-2 text-xs">
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {on
                ? tr(
                    'Your school turned this on for everyone on this computer, so it can’t be changed here (the file is {file}).',
                    { file: managed?.filePath ?? '' }
                  )
                : tr(
                    'Your school set this for everyone on this computer, so it can’t be changed here (the file is {file}).',
                    { file: managed?.filePath ?? '' }
                  )}
            </span>
          </p>
        ) : (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={on}
              disabled={update.isPending}
              onChange={(e) => update.mutate({ pilotMode: e.target.checked })}
            />
            <span>
              {tr('Keep everything on this computer (local-only pilot)')}
              <span className="block text-xs text-[var(--color-text-muted)]">
                {tr('Your Portal address and AI key stay saved but aren’t used while this is on.')}
              </span>
            </span>
          </label>
        )}
      </CardBody>
    </Card>
  )
}

/** Names on shared screens: how students' names appear on the classroom tools' pages on
 * the school Wi-Fi. */
export function SharedScreenNamesCard(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  if (!settings) return null
  const inUse = sharedScreenNameFormat(settings)
  const usual = sharedScreenNameFormat({ ...settings, sharedScreenNames: '' })

  return (
    <Card id="settings-shared-names" className="scroll-mt-4">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Names on shared screens')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'Exit tickets, QR check-in and the classroom screen show the class list so students can pick their name. Anyone on the school Wi-Fi with that session’s link can see it, over plain http, while the tool is open. Your own screens always show full names.'
          )}
        </p>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">{tr('Names on shared screens')}</legend>
          {SHARED_SCREEN_NAME_FORMATS.map((format) => (
            <label key={format} className="flex items-center gap-2">
              <input
                type="radio"
                name="shared-screen-names"
                checked={inUse === format}
                disabled={update.isPending}
                onChange={() =>
                  update.mutate({ sharedScreenNames: format === usual ? '' : format })
                }
              />
              <span>
                {tr(SHARED_SCREEN_NAME_LABELS[format])}
                {format === usual && (
                  <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">
                    {tr('(default)')}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'With “Student number only”, a student without a number is shown by their initials. Names that would look the same are numbered.'
          )}
        </p>
      </CardBody>
    </Card>
  )
}

export function DataFlowsCard(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  if (!settings) return null
  const pilot = settings.pilotMode === true

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Network size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Every connection EduBoard can make')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'Everything else stays in the database on this computer. Your school’s IT can read the same list in docs/DATA_FLOWS.md.'
          )}
        </p>
        <ul className="space-y-3">
          {DATA_FLOWS.map((flow) => {
            return (
              <li
                key={flow.id}
                className="rounded-md border border-[var(--color-border)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{tr(flow.name)}</h3>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    {tr('In a pilot:')}
                    <Badge tone={pilot && flow.pilot === 'blocked' ? 'success' : TONE[flow.pilot]}>
                      {tr(PILOT_TREATMENT_LABELS[flow.pilot])}
                    </Badge>
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-[var(--color-text-muted)]">{tr('Goes to')}</dt>
                  <dd>{tr(flow.destination)}</dd>
                  <dt className="text-[var(--color-text-muted)]">{tr('Sends')}</dt>
                  <dd>{tr(flow.sends)}</dd>
                  <dt className="text-[var(--color-text-muted)]">{tr('When')}</dt>
                  <dd>{tr(flow.when)}</dd>
                  <dt className="text-[var(--color-text-muted)]">{tr('By default')}</dt>
                  <dd>{tr(flow.defaultNote)}</dd>
                  <dt className="text-[var(--color-text-muted)]">{tr('In a pilot')}</dt>
                  <dd>{tr(flow.pilotNote)}</dd>
                </dl>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

export function PilotSummaryCard(): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const { data: summary, refetch } = useQuery({
    queryKey: ['pilotSummary'],
    queryFn: () => window.api.pilotSummary.preview(),
    staleTime: 0
  })
  const label = (id: string): string =>
    tr(PILOT_SUMMARY_FEATURES.find((f) => f.id === id)?.label ?? id)

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileBarChart size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Pilot summary')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-[var(--color-text-muted)]">
          {tr(
            'At the end of a pilot, save this file and send it yourself to whoever runs the pilot, if you’re happy to. It holds rough counts only: no names, grades, comments or anything anyone wrote. EduBoard never sends it.'
          )}
        </p>
        {summary && (
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
              {tr('Exactly what the file contains')}
            </p>
            <pre className="max-h-80 overflow-auto rounded-md bg-[var(--color-surface-muted)] p-2 text-xs">
              {JSON.stringify(summary, null, 2)}
            </pre>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
              {Object.entries(summary.features).map(([id, band]) => (
                <li key={id}>
                  {label(id)}: {band === 'none' ? tr('not used') : band}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setMessage(null)
              try {
                // Show the latest counts, then save exactly what's shown.
                await refetch()
                const r = await window.api.pilotSummary.save()
                setMessage(r.saved ? tr('Saved to {path}', { path: r.filePath }) : null)
              } catch (err) {
                setMessage(ipcErrorMessage(err, tr('The pilot summary couldn’t be saved.')))
              }
            }}
          >
            <Download size={13} className="mr-1 inline" aria-hidden />
            {tr('Save pilot summary…')}
          </Button>
        </div>
        {message && <p className="text-[var(--color-text-muted)]">{message}</p>}
      </CardBody>
    </Card>
  )
}

/** Shown at the top of Settings → Portal and families, and → AI, in a pilot. */
export function PilotOffNotice({ what }: { what: string }): React.JSX.Element {
  return (
    <p className="flex items-start gap-2 rounded-md bg-[var(--color-success-soft)] px-3 py-2 text-sm">
      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden />
      <span>
        {tr(
          '{what}: turned off, because this computer is in a local-only pilot, so nothing goes to the internet. See What leaves this computer.',
          { what }
        )}
      </span>
    </p>
  )
}
