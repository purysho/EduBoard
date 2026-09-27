// A school pack: one file a head of department makes once (Settings → School pack →
// Export) and every teacher imports, so the whole school gets the same logo, colour,
// grading scale, terms and lists without an account or a server. Everything in it is
// checked on import, since the file comes from outside the app.
import type { AppSettings, GradeThresholds, LogQuickAdd, StudentField, Term } from './types'
import { STUDENT_LOG_TYPES } from './types'
import { gradeBands, scaleProblem } from './gradeScales'
import { COMMENT_CATEGORIES, type BankComment } from './commentBank'
import { BUILT_IN_STATUSES, type AttendanceCode } from './attendanceCodes'
import { RENAMEABLE_WORDS, tr, type RenameableWord, type Terminology } from './i18n'

export interface SchoolPackTerm {
  name: string
  schoolYear: string
  startDate: string | null
  endDate: string | null
}

export interface SchoolPack {
  kind: 'eduboard-school-pack'
  version: 1
  createdAt: string
  schoolName?: string
  schoolLogo?: string
  accentColor?: string
  defaultGradeThresholds?: GradeThresholds
  defaultPassMark?: number
  defaultMaxScore?: number
  logQuickAdds?: LogQuickAdd[]
  studentFields?: StudentField[]
  terms?: SchoolPackTerm[]
  customCss?: string
  commentBank?: BankComment[]
  letterTemplate?: string
  attendanceCodes?: AttendanceCode[]
  terminology?: Terminology
}

const MAX_LOGO_CHARS = 700_000
const MAX_CSS_CHARS = 50_000

/** A school stylesheet may change how EduBoard looks, but never fetch anything: no
 * @import, and no url() except inline data: images. Also drops old IE script hooks. */
export function sanitizeCss(css: string): string {
  return (
    css
      .slice(0, MAX_CSS_CHARS)
      // It's set as a <style> element's text, never parsed as HTML, but CSS never needs '<'.
      .replace(/</g, '')
      .replace(/@import[^;]*;?/gi, '')
      .replace(/url\(\s*(?!['"]?data:image\/(?:png|jpeg|webp|gif);base64,)[^)]*\)/gi, 'none')
      .replace(/expression\s*\(/gi, '(')
      .replace(/behavior\s*:/gi, 'x-behavior:')
      .replace(/javascript:/gi, '')
  )
}

const isString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max
const isDate = (v: unknown): v is string | null =>
  v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))

/** Reads a pack from JSON, keeping only what's valid. Throws with a plain reason if the
 * file isn't a school pack at all. */
export function parseSchoolPack(json: string): SchoolPack {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error(tr('That file isn’t a school pack (it isn’t readable JSON).'))
  }
  if (!raw || raw.kind !== 'eduboard-school-pack' || raw.version !== 1) {
    throw new Error(tr('That file isn’t an EduBoard school pack.'))
  }
  const pack: SchoolPack = {
    kind: 'eduboard-school-pack',
    version: 1,
    createdAt: isString(raw.createdAt, 40) ? raw.createdAt : ''
  }
  if (isString(raw.schoolName) && raw.schoolName.trim()) pack.schoolName = raw.schoolName.trim()
  if (
    typeof raw.schoolLogo === 'string' &&
    raw.schoolLogo.length <= MAX_LOGO_CHARS &&
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw.schoolLogo)
  ) {
    pack.schoolLogo = raw.schoolLogo
  }
  if (typeof raw.accentColor === 'string' && /^(#[0-9a-f]{6})?$/i.test(raw.accentColor)) {
    pack.accentColor = raw.accentColor
  }
  const t = raw.defaultGradeThresholds as GradeThresholds | undefined
  if (
    t &&
    ['A', 'B', 'C', 'D'].every((k) => typeof t[k as 'A'] === 'number') &&
    (!t.scale ||
      (Array.isArray(t.scale) &&
        t.scale.every((b) => isString(b?.label, 20) && typeof b?.min === 'number') &&
        scaleProblem(gradeBands(t)) === null))
  ) {
    pack.defaultGradeThresholds = {
      A: t.A,
      B: t.B,
      C: t.C,
      D: t.D,
      ...(t.scale ? { scale: t.scale.map((b) => ({ label: b.label, min: b.min })) } : {})
    }
  }
  for (const key of ['defaultPassMark', 'defaultMaxScore'] as const) {
    const v = raw[key]
    if (typeof v === 'number' && v > 0 && v <= 1000) pack[key] = v
  }
  if (Array.isArray(raw.logQuickAdds)) {
    const list = raw.logQuickAdds.filter(
      (q): q is LogQuickAdd =>
        isString(q?.label, 60) &&
        isString(q?.text, 500) &&
        (STUDENT_LOG_TYPES as readonly string[]).includes(q?.type)
    )
    if (list.length) {
      pack.logQuickAdds = list.map((q) => ({
        label: q.label,
        type: q.type,
        text: q.text,
        ...(q.contactMethod ? { contactMethod: q.contactMethod } : {})
      }))
    }
  }
  if (Array.isArray(raw.studentFields)) {
    const list = raw.studentFields.filter(
      (f): f is StudentField => isString(f?.id, 64) && isString(f?.label, 60) && !!f.label.trim()
    )
    if (list.length) pack.studentFields = list.map((f) => ({ id: f.id, label: f.label }))
  }
  if (Array.isArray(raw.terms)) {
    const list = raw.terms.filter(
      (x): x is SchoolPackTerm =>
        isString(x?.name, 80) &&
        isString(x?.schoolYear, 40) &&
        isDate(x?.startDate ?? null) &&
        isDate(x?.endDate ?? null)
    )
    if (list.length) {
      pack.terms = list.map((x) => ({
        name: x.name,
        schoolYear: x.schoolYear,
        startDate: x.startDate ?? null,
        endDate: x.endDate ?? null
      }))
    }
  }
  if (Array.isArray(raw.commentBank)) {
    const list = raw.commentBank.filter(
      (c): c is BankComment =>
        isString(c?.text, 400) &&
        !!c.text.trim() &&
        (COMMENT_CATEGORIES as readonly string[]).includes(c?.category)
    )
    if (list.length) pack.commentBank = list.map((c) => ({ category: c.category, text: c.text }))
  }
  if (isString(raw.letterTemplate, 5000) && raw.letterTemplate.trim()) {
    pack.letterTemplate = raw.letterTemplate
  }
  if (Array.isArray(raw.attendanceCodes)) {
    const list = raw.attendanceCodes.filter(
      (c): c is AttendanceCode =>
        typeof c?.id === 'string' &&
        /^(present|late|absent|excused|c:[a-z0-9]{1,16})$/.test(c.id) &&
        isString(c?.label, 40) &&
        isString(c?.letter, 4) &&
        [...c.letter].length <= 2 &&
        (BUILT_IN_STATUSES as readonly string[]).includes(c?.countsAs) &&
        (c.id.startsWith('c:') || c.countsAs === c.id)
    )
    if (list.length) {
      pack.attendanceCodes = list.map((c) => ({
        id: c.id,
        label: c.label,
        letter: c.letter,
        countsAs: c.countsAs,
        ...(c.hidden === true ? { hidden: true } : {})
      }))
    }
  }
  const words = raw.terminology as Terminology | undefined
  if (words && typeof words === 'object') {
    const keys = Object.keys(RENAMEABLE_WORDS) as RenameableWord[]
    const en: NonNullable<Terminology['en']> = {}
    const zh: NonNullable<Terminology['zh']> = {}
    for (const k of keys) {
      const e = words.en?.[k]
      if (e && isString(e.one, 40) && isString(e.other, 40) && e.one.trim()) {
        en[k] = { one: e.one.trim(), other: e.other.trim() }
      }
      const z = words.zh?.[k]
      if (isString(z, 20) && z.trim()) zh[k] = z.trim()
    }
    if (Object.keys(en).length || Object.keys(zh).length) {
      pack.terminology = {
        ...(Object.keys(en).length ? { en } : {}),
        ...(Object.keys(zh).length ? { zh } : {})
      }
    }
  }
  if (typeof raw.customCss === 'string' && raw.customCss.trim()) {
    pack.customCss = sanitizeCss(raw.customCss)
  }
  return pack
}

/** What this computer would share: the school-wide parts of its settings and terms. */
export function makeSchoolPack(settings: AppSettings, terms: Term[]): SchoolPack {
  return {
    kind: 'eduboard-school-pack',
    version: 1,
    createdAt: new Date().toISOString(),
    ...(settings.schoolName ? { schoolName: settings.schoolName } : {}),
    ...(settings.schoolLogo ? { schoolLogo: settings.schoolLogo } : {}),
    accentColor: settings.accentColor,
    defaultGradeThresholds: settings.defaultGradeThresholds,
    defaultPassMark: settings.defaultPassMark,
    defaultMaxScore: settings.defaultMaxScore,
    logQuickAdds: settings.logQuickAdds,
    studentFields: settings.studentFields,
    terms: terms.map((t) => ({
      name: t.name,
      schoolYear: t.schoolYear,
      startDate: t.startDate,
      endDate: t.endDate
    })),
    ...(settings.customCss ? { customCss: settings.customCss } : {}),
    commentBank: settings.commentBank,
    letterTemplate: settings.letterTemplate,
    ...(settings.attendanceCodes?.length ? { attendanceCodes: settings.attendanceCodes } : {}),
    ...(settings.terminology && Object.keys(settings.terminology).length
      ? { terminology: settings.terminology }
      : {})
  }
}

export interface SchoolPackPlan {
  settings: Partial<AppSettings>
  newTerms: SchoolPackTerm[]
  /** Plain-words list for the confirmation screen. */
  changes: string[]
}

/** What importing the pack would change here. Terms already present (same name and
 * school year) are left alone; student fields are added to, never removed. */
export function planSchoolPack(
  pack: SchoolPack,
  settings: AppSettings,
  terms: Term[]
): SchoolPackPlan {
  const patch: Partial<AppSettings> = {}
  const changes: string[] = []
  if (pack.schoolName && pack.schoolName !== settings.schoolName) {
    patch.schoolName = pack.schoolName
    changes.push(tr('School name: {name}', { name: pack.schoolName }))
  }
  if (pack.schoolLogo && pack.schoolLogo !== settings.schoolLogo) {
    patch.schoolLogo = pack.schoolLogo
    changes.push(tr('School logo'))
  }
  if (pack.accentColor !== undefined && pack.accentColor !== settings.accentColor) {
    patch.accentColor = pack.accentColor
    changes.push(
      pack.accentColor
        ? tr('School colour {colour}', { colour: pack.accentColor })
        : tr('EduBoard’s own colour')
    )
  }
  if (
    pack.defaultGradeThresholds &&
    JSON.stringify(pack.defaultGradeThresholds) !== JSON.stringify(settings.defaultGradeThresholds)
  ) {
    patch.defaultGradeThresholds = pack.defaultGradeThresholds
    changes.push(
      tr('Grading scale for new classes: {bands}', {
        bands: gradeBands(pack.defaultGradeThresholds)
          .map((b) => b.label)
          .join(' / ')
      })
    )
  }
  if (pack.defaultPassMark && pack.defaultPassMark !== settings.defaultPassMark) {
    patch.defaultPassMark = pack.defaultPassMark
    changes.push(tr('Pass mark for new classes: {n}%', { n: pack.defaultPassMark }))
  }
  if (pack.defaultMaxScore && pack.defaultMaxScore !== settings.defaultMaxScore) {
    patch.defaultMaxScore = pack.defaultMaxScore
    changes.push(tr('Default max score: {n}', { n: pack.defaultMaxScore }))
  }
  if (
    pack.logQuickAdds &&
    JSON.stringify(pack.logQuickAdds) !== JSON.stringify(settings.logQuickAdds)
  ) {
    patch.logQuickAdds = pack.logQuickAdds
    changes.push(
      tr('Log quick-add buttons: {list}', {
        list: pack.logQuickAdds.map((q) => q.label).join(', ')
      })
    )
  }
  if (pack.studentFields) {
    const have = new Set(settings.studentFields.map((f) => f.id))
    const added = pack.studentFields.filter((f) => !have.has(f.id))
    if (added.length) {
      patch.studentFields = [...settings.studentFields, ...added]
      changes.push(
        tr('Student fields added: {list}', { list: added.map((f) => f.label).join(', ') })
      )
    }
  }
  if (
    pack.commentBank &&
    JSON.stringify(pack.commentBank) !== JSON.stringify(settings.commentBank)
  ) {
    patch.commentBank = pack.commentBank
    changes.push(tr('Report comment bank ({n} comments)', { n: pack.commentBank.length }))
  }
  if (pack.letterTemplate && pack.letterTemplate !== settings.letterTemplate) {
    patch.letterTemplate = pack.letterTemplate
    changes.push(tr('Parent letter'))
  }
  if (pack.attendanceCodes) {
    // The pack's codes are added or renamed; codes this computer already uses stay, so
    // no day already marked loses its meaning.
    const merged = [...(settings.attendanceCodes ?? [])]
    for (const code of pack.attendanceCodes) {
      const at = merged.findIndex((c) => c.id === code.id)
      if (at >= 0) merged[at] = code
      else merged.push(code)
    }
    if (JSON.stringify(merged) !== JSON.stringify(settings.attendanceCodes ?? [])) {
      patch.attendanceCodes = merged
      changes.push(
        tr('Attendance codes: {list}', {
          list: pack.attendanceCodes
            .filter((c) => c.label.trim())
            .map((c) => c.label)
            .join(', ')
        })
      )
    }
  }
  if (
    pack.terminology &&
    JSON.stringify(pack.terminology) !== JSON.stringify(settings.terminology ?? {})
  ) {
    patch.terminology = pack.terminology
    changes.push(tr('The school’s own words (for class, student, assessment…)'))
  }
  if (pack.customCss !== undefined && pack.customCss !== settings.customCss) {
    patch.customCss = pack.customCss
    changes.push(tr('School stylesheet'))
  }
  const key = (t: { name: string; schoolYear: string }): string =>
    `${t.name.trim().toLowerCase()}|${t.schoolYear.trim()}`
  const existing = new Set(terms.map(key))
  const newTerms = (pack.terms ?? []).filter((t) => !existing.has(key(t)))
  if (newTerms.length) {
    changes.push(
      tr('Terms added: {list}', {
        list: newTerms.map((t) => `${t.name} ${t.schoolYear}`).join(', ')
      })
    )
  }
  return { settings: patch, newTerms, changes }
}
