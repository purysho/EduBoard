// Parent letters: one template, a personalised copy per student, printed together.

export const DEFAULT_LETTER_TEMPLATE = `Dear {guardian},

This is a short update on {name}'s progress in {class}.

{name}'s current grade is {grade} ({percent}), and attendance so far is {attendance}.

Please get in touch if you have any questions.

Kind regards,
{teacher}
{school}`

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
  const na = 'not yet available'
  return template
    .replace(/\{guardian\}/g, c.guardian?.trim() || `Parent or guardian of ${c.name}`)
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
