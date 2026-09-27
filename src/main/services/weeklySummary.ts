// The teacher's own weekly summary: the families' digest is about one child; this is
// about every class at once, and it includes what families never see (students to
// check on, follow-ups owed, homework not handed in). Built here from this computer's
// data, then shown in the app, printed, or emailed to the teacher through the Portal.
import { listClasses } from '../repositories/classes'
import { getRosterForClass } from '../repositories/enrollments'
import { listLessonPlansByClass } from '../repositories/lessonPlans'
import {
  listHomeworkAssignmentsByClass,
  listSubmissionsForAssignment
} from '../repositories/homeworkAssignments'
import { getClassReport } from './reports'
import { getTodayOverview, getWatchList } from './today'
import { getSettings } from '../repositories/settingsRepo'
import { tr, trn, uiLocale } from '@shared/i18n'
import type { WeeklySummary, WeeklySummaryClass } from '@shared/summaries'

export type { WeeklySummary, WeeklySummaryClass }

const iso = (d: Date): string => d.toISOString().slice(0, 10)

export function getWeeklySummary(now: Date = new Date()): WeeklySummary {
  const day = 24 * 60 * 60 * 1000
  const weekAgo = iso(new Date(now.getTime() - 7 * day))
  const today = iso(now)
  const weekAhead = iso(new Date(now.getTime() + 7 * day))
  const classes = listClasses(false).map((cls) => {
    const report = getClassReport(cls.id)
    const active = getRosterForClass(cls.id).filter((r) => r.enrollment.status === 'active')
    const plans = listLessonPlansByClass(cls.id)
    const homework = listHomeworkAssignmentsByClass(cls.id).filter(
      (h) => h.status === 'published' && h.dueDate
    )
    return {
      classId: cls.id,
      name: cls.name,
      students: active.length,
      averagePercent: report?.averagePercent ?? null,
      passRate: report?.passRate ?? null,
      attendanceRate: report?.averageAttendanceRate ?? null,
      taught: plans
        .filter((p) => p.date >= weekAgo && p.date <= today && p.status !== 'skipped')
        .map((p) => p.title),
      comingUp: plans.filter((p) => p.date > today && p.date <= weekAhead).map((p) => p.title),
      dueSoon: homework
        .filter((h) => h.dueDate!.slice(0, 10) >= today && h.dueDate!.slice(0, 10) <= weekAhead)
        .map((h) => ({ title: h.title, dueDate: h.dueDate!.slice(0, 10) })),
      notHandedIn: homework
        .filter((h) => h.dueDate!.slice(0, 10) >= weekAgo && h.dueDate!.slice(0, 10) < today)
        .map((h) => {
          const subs = listSubmissionsForAssignment(h.id, cls.id)
          return {
            title: h.title,
            missing: subs.filter((s) => s.status === 'not_started').length,
            of: subs.length
          }
        })
        .filter((h) => h.missing > 0)
    }
  })
  return {
    weekOf: today,
    classes,
    watchList: getWatchList(now),
    followUpsDue: getTodayOverview(now).followUpsDue
  }
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const pct = (v: number | null, times = 1): string =>
  v === null ? '—' : `${Math.round(v * times)}%`

/** The summary as a self-contained, inline-styled page: the same HTML is shown in the
 * app, printed, and emailed, so what the teacher checks is what they get. */
export function weeklySummaryHtml(summary: WeeklySummary): string {
  const settings = getSettings()
  const date = new Date(summary.weekOf).toLocaleDateString(uiLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const h = (text: string): string =>
    `<p style="margin:16px 0 4px;font-weight:600;color:#334155">${esc(text)}</p>`
  const list = (items: string[]): string =>
    items.length
      ? `<ul style="margin:4px 0 0 18px;padding:0">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
      : ''

  const classBlocks = summary.classes
    .map((c) => {
      const notes = [
        ...(c.taught.length ? [tr('Taught: {list}', { list: c.taught.join(', ') })] : []),
        ...(c.comingUp.length ? [tr('Coming up: {list}', { list: c.comingUp.join(', ') })] : []),
        ...c.dueSoon.map((d) => tr('Due {date}: {title}', { date: d.dueDate, title: d.title })),
        ...c.notHandedIn.map((m) =>
          tr('{title}: {missing} of {of} not handed in', {
            title: m.title,
            missing: m.missing,
            of: m.of
          })
        )
      ]
      return `<div style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px">
  <p style="margin:0;font-weight:600">${esc(c.name)}</p>
  <p style="margin:4px 0 0;color:#475569;font-size:13px">${esc(
    [
      trn('{n} student', '{n} students', c.students),
      tr('average {value}', { value: pct(c.averagePercent) }),
      tr('pass rate {value}', { value: pct(c.passRate, 100) }),
      tr('attendance {value}', { value: pct(c.attendanceRate, 100) })
    ].join(' · ')
  )}</p>
  ${list(notes)}
</div>`
    })
    .join('')

  const watch = summary.watchList.length
    ? h(tr('Students to check on ({length})', { length: summary.watchList.length })) +
      list(
        summary.watchList.map((w) => `${w.studentName} (${w.className}): ${w.reasons.join('; ')}`)
      )
    : ''
  const followUps = summary.followUpsDue
    ? `<p style="margin:16px 0 0;padding:10px;background:#fef3c7;border-radius:8px">${esc(
        trn('{n} parent follow-up is due.', '{n} parent follow-ups are due.', summary.followUpsDue)
      )}</p>`
    : ''

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
<h2 style="margin:0">${esc(tr('Your week'))}</h2>
<p style="margin:2px 0 0;color:#64748b">${esc(
    [settings.teacherName, settings.schoolName, date].filter(Boolean).join(' · ')
  )}</p>
${classBlocks || `<p>${esc(tr('No classes yet.'))}</p>`}
${watch}
${followUps}
</div>`
}
