import { useRef, useState } from 'react'
import { FileDown, ImagePlus, Palette, X } from 'lucide-react'
import type { CssCheck } from '@shared/cssCheck'
import type { AppSettings } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { ACCENT_PRESETS, isHexColour, whiteTextContrast } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/cn'
import { tr, trn } from '@shared/i18n'

const MAX_LOGO_PX = 256

/** Reads an image file and returns it as a PNG data URL no larger than 256px, so a
 * school's full-size logo doesn't bloat every settings read and printout. */
async function logoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_LOGO_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

/** What a stylesheet just loaded changes, in plain words. */
function describeCssCheck(c: CssCheck): { ok: boolean; text: string } {
  const cut = c.truncated
    ? ' ' + tr('It was longer than 50,000 characters, so only the start is used.')
    : ''
  if (c.tokens.length) {
    return {
      ok: true,
      text:
        trn(
          'Loaded. It sets {n} of EduBoard’s colours.',
          'Loaded. It sets {n} of EduBoard’s colours.',
          c.tokens.length
        ) + cut
    }
  }
  const total = c.generalRules + c.otherRules
  if (c.generalRules > 0 && c.otherRules <= c.generalRules * 4) {
    return {
      ok: true,
      text:
        trn(
          'Loaded. {n} of its rules style text, headings or buttons on every screen.',
          'Loaded. {n} of its rules style text, headings or buttons on every screen.',
          c.generalRules
        ) + cut
    }
  }
  return {
    ok: false,
    text:
      (c.generalRules > 0
        ? trn(
            'Loaded, but it looks like a stylesheet made for another website: only {n} of its {total} rules applies to EduBoard, so you’ll see little or no change.',
            'Loaded, but it looks like a stylesheet made for another website: only {n} of its {total} rules apply to EduBoard, so you’ll see little or no change.',
            c.generalRules,
            { total }
          )
        : tr(
            'Loaded, but nothing in it applies to EduBoard, so nothing changes. It looks like a stylesheet made for another website.'
          )) +
      ' ' +
      tr(
        'To change EduBoard’s colours, use “Save an example to start from”, change the colours in it and load that file instead.'
      ) +
      cut
  }
}

/** Settings → Appearance: the school's logo and colour, and text size and contrast.
 * Every change applies at once. */
export function AppearancePanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [customHex, setCustomHex] = useState('')
  const [cssNote, setCssNote] = useState<{ ok: boolean; text: string } | null>(null)
  if (!settings) return null

  const set = (patch: Partial<AppSettings>): void => update.mutate(patch)
  const accent = settings.accentColor
  const lowContrast = isHexColour(accent) && whiteTextContrast(accent) < 4.5

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Palette size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Appearance')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-5 text-sm">
        <section>
          <h3 className="mb-2 font-medium">{tr('School logo')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
              {settings.schoolLogo ? (
                <img
                  src={settings.schoolLogo}
                  alt={tr('School logo')}
                  className="max-h-full max-w-full"
                />
              ) : (
                <ImagePlus size={20} className="text-[var(--color-text-muted)]" aria-hidden />
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
              {settings.schoolLogo ? tr('Change logo') : tr('Add logo')}
            </Button>
            {settings.schoolLogo && (
              <Button variant="ghost" size="sm" onClick={() => set({ schoolLogo: '' })}>
                <X size={13} className="mr-1 inline" aria-hidden />
                {tr('Remove')}
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setLogoError(null)
                try {
                  set({ schoolLogo: await logoDataUrl(file) })
                } catch {
                  setLogoError(tr('That file couldn’t be read as an image. Try a PNG or JPEG.'))
                }
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
            {tr('Shown in the sidebar and on report cards and other printouts.')}
          </p>
          {logoError && <p className="mt-1 text-xs text-[var(--color-danger)]">{logoError}</p>}
        </section>

        <section>
          <h3 className="mb-2 font-medium">{tr('School colour')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.name}
                title={p.name}
                aria-label={p.name}
                aria-pressed={accent === p.hex}
                onClick={() => set({ accentColor: p.hex })}
                className={cn(
                  'h-7 w-7 rounded-full border-2',
                  accent === p.hex ? 'border-[var(--color-text)]' : 'border-transparent'
                )}
                style={{ background: p.hex || '#4f46e5' }}
              />
            ))}
            <label className="ml-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              {tr('Other')}
              <input
                type="color"
                value={isHexColour(accent) ? accent : '#4f46e5'}
                onChange={(e) => set({ accentColor: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
              />
              <input
                className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 font-mono text-xs text-[var(--color-text)]"
                placeholder="#1d4ed8"
                value={customHex}
                onChange={(e) => {
                  setCustomHex(e.target.value)
                  if (isHexColour(e.target.value.trim()))
                    set({ accentColor: e.target.value.trim() })
                }}
              />
            </label>
          </div>
          {lowContrast && (
            <p className="mt-1.5 text-xs text-[var(--color-warning)]">
              {tr(
                'This colour is light, so white text on buttons may be hard to read. A darker shade works better.'
              )}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1 font-medium">{tr('School stylesheet')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'For a school that wants its own colours, background or fonts: a .css file applied on top of EduBoard’s look. It works by changing EduBoard’s colour names (such as --color-bg, --color-surface, --color-primary), so a stylesheet made for a website won’t change anything. Start from the example. It can use inline images, but can’t load anything from the internet.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const check = await window.api.schoolPack.importCss()
                if (!check) return
                await update.mutateAsync({})
                setCssNote(describeCssCheck(check))
              }}
            >
              {settings.customCss ? tr('Replace stylesheet') : tr('Load .css file')}
            </Button>
            {settings.customCss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  set({ customCss: '' })
                  setCssNote(null)
                }}
              >
                <X size={13} className="mr-1 inline" aria-hidden />
                {tr('Remove')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.api.schoolPack.saveExampleCss()}
            >
              <FileDown size={13} className="mr-1 inline" aria-hidden />
              {tr('Save an example to start from')}
            </Button>
          </div>
          {cssNote && (
            <p
              role="status"
              className={cn(
                'mt-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)]',
                cssNote.ok ? 'bg-[var(--color-success-soft)]' : 'bg-[var(--color-warning-soft)]'
              )}
            >
              {cssNote.text}
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block font-medium">{tr('Text size')}</span>
            <select
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5"
              value={settings.textSize}
              onChange={(e) => set({ textSize: e.target.value as AppSettings['textSize'] })}
            >
              <option value="small">{tr('Small')}</option>
              <option value="normal">{tr('Normal')}</option>
              <option value="large">{tr('Large')}</option>
              <option value="larger">{tr('Larger')}</option>
            </select>
          </label>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) => set({ highContrast: e.target.checked })}
              />
              {tr('Higher contrast')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => set({ reduceMotion: e.target.checked })}
              />
              {tr('Reduce motion')}
            </label>
          </div>
        </section>
      </CardBody>
    </Card>
  )
}
