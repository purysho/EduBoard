import { useRef, useState } from 'react'
import { FileDown, ImagePlus, Lock, Palette, X } from 'lucide-react'
import type { CssCheck } from '@shared/cssCheck'
import type { AppSettings } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useManagedBranding, useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { cleanAppName, MAX_APP_NAME, PRODUCT_NAME, type BrandingKey } from '@shared/branding'
import { ACCENT_PRESETS, isHexColour, whiteTextContrast } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/cn'
import { styleLibrary } from '@shared/styleLibrary'
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
  const { data: managed } = useManagedBranding()
  const [appName, setAppName] = useState<string | null>(null)
  if (!settings) return null
  const locked = (key: BrandingKey): boolean => !!managed?.locked.includes(key)
  const saveAppName = (): void => {
    if (appName === null) return
    const clean = cleanAppName(appName)
    setAppName(null)
    if (clean !== settings.appDisplayName) set({ appDisplayName: clean })
  }

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
        {managed && managed.locked.length > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-[var(--color-primary-soft)] px-3 py-2 text-xs text-[var(--color-text)]">
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {tr(
                'Your school set the app’s name, logo and look for everyone on this computer, so they can’t be changed here. To change them, ask whoever looks after the school’s computers (the file is {file}).',
                { file: managed.filePath }
              )}
            </span>
          </p>
        )}
        <section>
          <h3 className="mb-2 font-medium">{tr('App name')}</h3>
          <input
            className="w-full max-w-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[var(--color-text)] disabled:opacity-60"
            aria-label={tr('App name')}
            placeholder={PRODUCT_NAME}
            maxLength={MAX_APP_NAME}
            disabled={locked('appDisplayName')}
            value={appName ?? settings.appDisplayName}
            onChange={(e) => setAppName(e.target.value)}
            onBlur={saveAppName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveAppName()
            }}
          />
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Your school’s own name for the app (for example “Riverside Teacher Hub”), shown in the sidebar, the window title and the lock screen instead of EduBoard. Leave empty for EduBoard. Updates and Settings → Help still say EduBoard.'
            )}
          </p>
        </section>

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
            <Button
              variant="secondary"
              size="sm"
              disabled={locked('schoolLogo')}
              onClick={() => fileInput.current?.click()}
            >
              {settings.schoolLogo ? tr('Change logo') : tr('Add logo')}
            </Button>
            {settings.schoolLogo && !locked('schoolLogo') && (
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
            {tr(
              'Shown in the sidebar, as the window’s icon in the taskbar, and on report cards and other printouts.'
            )}
          </p>
          {logoError && <p className="mt-1 text-xs text-[var(--color-danger)]">{logoError}</p>}
        </section>

        <section>
          <h3 className="mb-2 font-medium">{tr('School colour')}</h3>
          <fieldset
            disabled={locked('accentColor')}
            className="flex flex-wrap items-center gap-2 disabled:opacity-60"
          >
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
          </fieldset>
          {lowContrast && (
            <p className="mt-1.5 text-xs text-[var(--color-warning)]">
              {tr(
                'This colour is light, so white text on buttons may be hard to read. A darker shade works better.'
              )}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1 font-medium">{tr('Style library')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Ready-made looks for the whole app. Using one replaces the school stylesheet below; “Save a copy” gives you the .css file to change and load back.'
            )}
          </p>
          <fieldset
            disabled={locked('customCss')}
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          >
            {styleLibrary().map((style) => {
              const inUse = settings.customCss.trim() === style.css.trim()
              return (
                <div
                  key={style.id}
                  className={cn(
                    'flex flex-col rounded-lg border p-2',
                    inUse
                      ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                      : 'border-[var(--color-border)]'
                  )}
                >
                  {/* A small picture of the style: page, a card, a button and some text. */}
                  <div
                    aria-hidden
                    className="mb-2 h-16 rounded-md p-1.5"
                    style={{ background: style.swatch.bg }}
                  >
                    <div className="h-full rounded" style={{ background: style.swatch.surface }}>
                      <div className="flex h-full flex-col justify-between p-1.5">
                        <div
                          className="h-1.5 w-3/4 rounded-full"
                          style={{ background: style.swatch.text }}
                        />
                        <div
                          className="h-1.5 w-1/2 rounded-full opacity-50"
                          style={{ background: style.swatch.text }}
                        />
                        <div
                          className="h-3 w-10 rounded"
                          style={{ background: style.swatch.primary }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{style.name}</p>
                  <p className="mb-2 flex-1 text-xs text-[var(--color-text-muted)]">
                    {style.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant={inUse ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={inUse}
                      onClick={() => {
                        set({ customCss: style.css })
                        setCssNote(null)
                      }}
                    >
                      {inUse ? tr('In use') : tr('Use this')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.api.schoolPack.saveExampleCss(style.css, `eduboard-${style.id}.css`)
                      }
                    >
                      {tr('Save a copy')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </fieldset>
        </section>

        <section>
          <h3 className="mb-1 font-medium">{tr('School stylesheet')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'For a school that wants its own colours, background or fonts: a .css file applied on top of EduBoard’s look. It works by changing EduBoard’s colour names (such as --color-bg, --color-surface, --color-primary), so a stylesheet made for a website won’t change anything. Start from the example. It can use inline images, but can’t load anything from the internet.'
            )}
          </p>
          <fieldset disabled={locked('customCss')} className="flex items-center gap-2">
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
          </fieldset>
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
