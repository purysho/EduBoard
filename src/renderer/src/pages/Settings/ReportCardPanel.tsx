import { FileText } from 'lucide-react'
import {
  reportLayoutFromPreset,
  resolveReportLayout,
  type ReportCardLayout,
  type ReportLayoutPreset
} from '@shared/templates'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm'

/** Settings → Report cards: which layout printed report cards use, and what's on them. */
export function ReportCardPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  if (!settings) return null
  const layout = resolveReportLayout(settings.reportCard)
  const set = (patch: Partial<ReportCardLayout>): void =>
    update.mutate({ reportCard: { ...layout, ...patch } })

  const toggles: [keyof ReportCardLayout, string][] = [
    ['showCategories', tr('Category breakdown')],
    ['showAssessments', tr('Every assessment and its score')],
    ['showComment', tr('Report card comment')],
    ['showAttendance', tr('Attendance summary')],
    ['showPoints', tr('Class points by category')],
    ['showSignatures', tr('Signature lines for teacher and parent')]
  ]

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileText size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Report cards')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4 text-sm">
        <label className="block">
          <span className="mb-1 block font-medium">{tr('Layout')}</span>
          <select
            className={inputClass}
            value={layout.preset}
            onChange={(e) =>
              update.mutate({
                reportCard: {
                  ...reportLayoutFromPreset(e.target.value as ReportLayoutPreset),
                  title: layout.title,
                  footer: layout.footer
                }
              })
            }
          >
            <option value="standard">{tr('Standard: grade, categories, every assessment')}</option>
            <option value="compact">
              {tr('Compact: grade, attendance rate and comment only')}
            </option>
            <option value="detailed">{tr('Detailed: everything, with signature lines')}</option>
          </select>
        </label>
        <fieldset className="grid grid-cols-2 gap-1.5">
          <legend className="mb-1 font-medium">{tr('Show')}</legend>
          {toggles.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!layout[key]}
                onChange={(e) => set({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block font-medium">{tr('Title')}</span>
            <input
              className={inputClass}
              defaultValue={layout.title}
              placeholder={tr('Student report')}
              onBlur={(e) => e.target.value !== layout.title && set({ title: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">{tr('Line at the bottom')}</span>
            <input
              className={inputClass}
              defaultValue={layout.footer}
              placeholder={tr('e.g. Next term starts on 2 March.')}
              onBlur={(e) => e.target.value !== layout.footer && set({ footer: e.target.value })}
            />
          </label>
        </div>
      </CardBody>
    </Card>
  )
}
