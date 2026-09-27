import { BookmarkPlus } from 'lucide-react'
import type { SavedTemplate, TemplateKind } from '@shared/templates'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

const selectClass =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs'

/**
 * "Start from a template": EduBoard's own templates for this kind of writing, then the
 * teacher's saved ones, and a button to save what's written now as a new one.
 */
export function TemplatePicker({
  kind,
  builtIns,
  onPick,
  current
}: {
  kind: TemplateKind
  builtIns: { id: string; name: string }[]
  /** Applies a built-in (by id) or a saved template. */
  onPick: (choice: { builtInId: string } | { saved: SavedTemplate }) => void
  /** What "Save as template" saves; null when there's nothing to save yet. */
  current: () => Pick<SavedTemplate, 'body' | 'lesson'> | null
}): React.JSX.Element {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const saved = (settings?.savedTemplates ?? []).filter((t) => t.kind === kind)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={tr('Start from a template')}
        className={selectClass}
        value=""
        onChange={(e) => {
          const [source, id] = e.target.value.split(':')
          if (source === 'b') onPick({ builtInId: id })
          const own = saved.find((t) => t.id === id)
          if (source === 's' && own) onPick({ saved: own })
        }}
      >
        <option value="">{tr('Start from a template…')}</option>
        <optgroup label={tr('EduBoard’s')}>
          {builtIns.map((t) => (
            <option key={t.id} value={`b:${t.id}`}>
              {t.name}
            </option>
          ))}
        </optgroup>
        {saved.length > 0 && (
          <optgroup label={tr('Yours')}>
            {saved.map((t) => (
              <option key={t.id} value={`s:${t.id}`}>
                {t.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
        onClick={async () => {
          const content = current()
          if (!content || !settings) return
          const name = window.prompt(tr('Name this template'))?.trim()
          if (!name) return
          await update.mutateAsync({
            savedTemplates: [
              ...(settings.savedTemplates ?? []),
              { id: crypto.randomUUID(), kind, name: name.slice(0, 80), ...content }
            ]
          })
        }}
      >
        <BookmarkPlus size={12} aria-hidden />
        {tr('Save as template')}
      </button>
    </div>
  )
}
