// Parent letters: one template, a personalised copy per student, printed together.
import { tr, uiLanguage } from './i18n'

export const DEFAULT_LETTER_TEMPLATE = `Dear {guardian},

This is a short update on {name}'s progress in {class}.

{name}'s current grade is {grade} ({percent}), and attendance so far is {attendance}.

Please get in touch if you have any questions.

Kind regards,
{teacher}
{school}`

export const DEFAULT_LETTER_TEMPLATE_ZH = `{guardian}：

您好！现将{name}在{class}的学习情况简要告知如下。

{name}目前的成绩为{grade}（{percent}），出勤率为{attendance}。

如有任何问题，欢迎随时与我联系。

此致
敬礼

{teacher}
{school}
{date}`

/** The built-in letter in the interface language. */
export function defaultLetterTemplate(): string {
  return uiLanguage() === 'zh' ? DEFAULT_LETTER_TEMPLATE_ZH : DEFAULT_LETTER_TEMPLATE
}

export interface LetterContext {
  name: string
  guardian: string | null
  className: string
  grade: string | null
  percent: number | null
  attendanceRate: number | null
  teacher: string
  school: string
  date: string
}

/** Fills a letter's placeholders. With no guardian on file the greeting falls back to
 * "Parent or guardian of {name}"; a missing grade or attendance reads "not yet
 * available" rather than leaving a gap. */
export function fillLetter(template: string, c: LetterContext): string {
  const na = tr('not yet available')
  return template
    .replace(
      /\{guardian\}/g,
      c.guardian?.trim() || tr('Parent or guardian of {name}', { name: c.name })
    )
    .replace(/\{name\}/g, c.name)
    .replace(/\{class\}/g, c.className)
    .replace(/\{grade\}/g, c.grade ?? na)
    .replace(/\{percent\}/g, c.percent === null ? na : `${Math.round(c.percent)}%`)
    .replace(
      /\{attendance\}/g,
      c.attendanceRate === null ? na : `${Math.round(c.attendanceRate * 100)}%`
    )
    .replace(/\{teacher\}/g, c.teacher)
    .replace(/\{school\}/g, c.school)
    .replace(/\{date\}/g, c.date)
}
