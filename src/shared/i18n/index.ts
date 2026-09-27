// EduBoard's interface language: English or Simplified Chinese, like the Portal's
// (portal/public/i18n.js), and on the same principle: interface text is translated
// here, by hand, once. It never goes through AI, so it's instant, works offline and
// says the same thing every time.
//
// The English text is the key. tr('Save') returns the Chinese when the app is in
// Chinese and a translation exists, and the English otherwise, so a missing entry
// shows English rather than a blank or a key name. src/shared/i18n/__tests__ checks
// that every tr('…') and trn(…) in the app has an entry.
import { ZH } from './zh'

export type UiLanguage = 'en' | 'zh'

let current: UiLanguage = 'en'

export function setUiLanguage(lang: UiLanguage): void {
  current = lang
}

export function uiLanguage(): UiLanguage {
  return current
}

/** Locale for dates and numbers in the current interface language. */
export function uiLocale(): string {
  return current === 'zh' ? 'zh-CN' : 'en-GB'
}

/** The language a setting of '' (never chosen) means on this computer. */
export function languageFromLocale(locale: string | undefined | null): UiLanguage {
  return /^zh/i.test(locale ?? '') ? 'zh' : 'en'
}

export type TrVars = Record<string, string | number | null | undefined>

function fill(text: string, vars?: TrVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name] ?? '') : whole
  )
}

/** Interface text in the current language. {name} placeholders are filled from vars. */
export function tr(english: string, vars?: TrVars): string {
  const text = current === 'zh' ? (ZH[english] ?? english) : english
  return fill(text, vars)
}

/** Like tr, for text that depends on a count: English picks one or other; Chinese,
 * with no plural forms, always uses the translation of `other`. {n} is the count. */
export function trn(one: string, other: string, n: number, vars?: TrVars): string {
  const english = n === 1 ? one : other
  const text = current === 'zh' ? (ZH[other] ?? english) : english
  return fill(text, { n, ...vars })
}

/** Translates a message that may have come from elsewhere (an error from the main
 * process, say): the translation if this exact text has one, else unchanged. */
export function trMaybe(text: string): string {
  return current === 'zh' ? (ZH[text] ?? text) : text
}
