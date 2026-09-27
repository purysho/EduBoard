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

/** Words a school can rename, with their usual forms in each language. */
export const RENAMEABLE_WORDS = {
  class: { en: ['class', 'classes'], zh: '班级' },
  student: { en: ['student', 'students'], zh: '学生' },
  assessment: { en: ['assessment', 'assessments'], zh: '测评' },
  assignment: { en: ['assignment', 'assignments'], zh: '作业' },
  term: { en: ['term', 'terms'], zh: '学期' }
} as const
export type RenameableWord = keyof typeof RENAMEABLE_WORDS
/** A school's own words, per interface language: English has a singular and plural. */
export interface Terminology {
  en?: Partial<Record<RenameableWord, { one: string; other: string }>>
  zh?: Partial<Record<RenameableWord, string>>
}

let renames: { pattern: RegExp; replace: (match: string) => string }[] = []

/** Uses the school's own words (for the current language) in every tr() from now on. */
export function setTerminology(terminology: Terminology | undefined | null): void {
  renames = []
  if (current === 'zh') {
    for (const [word, custom] of Object.entries(terminology?.zh ?? {})) {
      const usual = RENAMEABLE_WORDS[word as RenameableWord]?.zh
      if (usual && custom?.trim()) {
        renames.push({ pattern: new RegExp(usual, 'g'), replace: () => custom.trim() })
      }
    }
    return
  }
  for (const [word, custom] of Object.entries(terminology?.en ?? {})) {
    const usual = RENAMEABLE_WORDS[word as RenameableWord]?.en
    if (!usual || !custom?.one.trim()) continue
    const one = custom.one.trim()
    const other = custom.other.trim() || one
    const capital = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)
    renames.push({
      pattern: new RegExp(`\\b(${usual[1]}|${usual[0]})\\b`, 'gi'),
      replace: (match) => {
        const plural = match.toLowerCase() === usual[1]
        const word = plural ? other : one
        return match[0] === match[0].toUpperCase() ? capital(word) : word
      }
    })
  }
}

/** Applies the school's words to interface text, leaving {placeholders} alone. */
function withSchoolWords(text: string): string {
  if (!renames.length) return text
  return text
    .split(/(\{\w+\})/)
    .map((part) =>
      /^\{\w+\}$/.test(part)
        ? part
        : renames.reduce((t, r) => t.replace(r.pattern, r.replace), part)
    )
    .join('')
}

function fill(text: string, vars?: TrVars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name] ?? '') : whole
  )
}

/** Interface text in the current language. {name} placeholders are filled from vars. */
export function tr(english: string, vars?: TrVars): string {
  const text = current === 'zh' ? (ZH[english] ?? english) : english
  return fill(withSchoolWords(text), vars)
}

/** Like tr, for text that depends on a count: English picks one or other; Chinese,
 * with no plural forms, always uses the translation of `other`. {n} is the count. */
export function trn(one: string, other: string, n: number, vars?: TrVars): string {
  const english = n === 1 ? one : other
  const text = current === 'zh' ? (ZH[other] ?? english) : english
  return fill(withSchoolWords(text), { n, ...vars })
}

/** Translates a message that may have come from elsewhere (an error from the main
 * process, say): the translation if this exact text has one, else unchanged. */
export function trMaybe(text: string): string {
  // Text from the main process is already in the school's words; only a translation
  // found here still needs them.
  return current === 'zh' && ZH[text] ? withSchoolWords(ZH[text]) : text
}
