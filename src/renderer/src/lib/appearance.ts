import type { AppSettings } from '@shared/types'
import { sanitizeCss } from '@shared/schoolPack'

// The school's colour, text size and contrast, applied on top of styles.css's tokens.

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Indigo (EduBoard)', hex: '' },
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Green', hex: '#15803d' },
  { name: 'Red', hex: '#b91c1c' },
  { name: 'Maroon', hex: '#7f1d1d' },
  { name: 'Orange', hex: '#c2410c' },
  { name: 'Purple', hex: '#7e22ce' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Slate', hex: '#334155' }
]

export function isHexColour(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Contrast of white button text on this colour (WCAG ratio, 1–21). */
export function whiteTextContrast(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

/** CSS that swaps in the accent for light and dark themes; '' for EduBoard's own. */
export function accentCss(hex: string): string {
  if (!isHexColour(hex)) return ''
  return `:root{--color-primary:${hex};--color-primary-hover:color-mix(in srgb,${hex} 82%,black);--color-primary-soft:color-mix(in srgb,${hex} 12%,white)}
.dark{--color-primary:color-mix(in srgb,${hex} 65%,white);--color-primary-hover:${hex};--color-primary-soft:color-mix(in srgb,${hex} 28%,#111827)}`
}

export const TEXT_ZOOM: Record<AppSettings['textSize'], number> = {
  small: 0.9,
  normal: 1,
  large: 1.125,
  larger: 1.25
}

/** Applies the appearance settings to the document. */
export function applyAppearance(
  s: Pick<AppSettings, 'accentColor' | 'textSize' | 'highContrast' | 'reduceMotion' | 'customCss'>
): void {
  const root = document.documentElement
  let style = document.getElementById('eb-accent') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'eb-accent'
    document.head.appendChild(style)
  }
  style.textContent = accentCss(s.accentColor)
  // The school stylesheet goes last so it can override the tokens above. Cleaned again
  // here (it was cleaned when saved) so nothing in it can load from the internet.
  let custom = document.getElementById('eb-custom') as HTMLStyleElement | null
  if (!custom) {
    custom = document.createElement('style')
    custom.id = 'eb-custom'
    document.head.appendChild(custom)
  }
  custom.textContent = s.customCss ? sanitizeCss(s.customCss) : ''
  root.style.zoom = String(TEXT_ZOOM[s.textSize] ?? 1)
  root.classList.toggle('high-contrast', s.highContrast)
  root.classList.toggle('reduce-motion', s.reduceMotion)
}
