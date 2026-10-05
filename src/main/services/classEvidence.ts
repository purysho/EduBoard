// How a class has been doing lately, for AI lesson drafts: the last few lessons (so the
// next one follows on), the speaking-ladder steps the class reached, recent assessment
// averages, and exit-ticket questions that suggested re-teaching. All of it is counts,
// averages and the teacher's own titles: no student is named or identifiable.
import type { LessonEvidence } from '@shared/types'
import { addDays } from '@shared/dates'
import { summarizeExitTicket } from '@shared/exitTicketSummary'
import { listLessonPlansByClass } from '../repositories/lessonPlans'
import { listLessonEvidenceByClass } from '../repositories/lessonEvidence'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listScoresByAssessment } from '../repositories/scores'
import { getExitTicketByClass, listExitTicketResponses } from '../repositories/exitTickets'

export interface ClassEvidence {
  /** The last lessons on or before today, oldest first. */
  recentLessons: { date: string; title: string; objectives: string }[]
  /** Speaking-ladder marks from the last lessons that have any, oldest first. */
  ladder: {
    date: string
    title: string
    marked: number
    median: number | null
    atLeast3: number
    complete: number
    missing: number
  }[]
  /** Recent assessments with enough scores to mean something, oldest first. */
  assessments: { name: string; average: number; scored: number }[]
  /** Exit-ticket questions in the last two weeks where under 70% showed understanding. */
  reteach: { prompt: string; understood: number }[]
}

const RECENT_LESSONS = 3
const LADDER_LESSONS = 3
const RECENT_ASSESSMENTS = 4
const MIN_SCORES = 3
const EXIT_TICKET_DAYS = 14
const MAX_TEXT = 200

const short = (text: string | null | undefined): string => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function classEvidenceFor(classId: string, today: string): ClassEvidence {
  const past = listLessonPlansByClass(classId)
    .filter((p) => p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const recentLessons = past
    .slice(-RECENT_LESSONS)
    .map((p) => ({ date: p.date, title: short(p.title), objectives: short(p.objectives) }))

  const evidenceByLesson = new Map<string, LessonEvidence[]>()
  for (const e of listLessonEvidenceByClass(classId)) {
    evidenceByLesson.set(e.lessonPlanId, [...(evidenceByLesson.get(e.lessonPlanId) ?? []), e])
  }
  const ladder = past
    .filter((p) => (evidenceByLesson.get(p.id) ?? []).some((e) => e.value !== 'N'))
    .slice(-LADDER_LESSONS)
    .map((p) => {
      const marks = (evidenceByLesson.get(p.id) ?? []).filter((e) => e.value !== 'N')
      const steps = marks.map((e) => Number(e.value)).filter((n) => Number.isInteger(n))
      return {
        date: p.date,
        title: short(p.title),
        marked: marks.length,
        median: median(steps),
        atLeast3: steps.filter((n) => n >= 3).length,
        complete: marks.filter((e) => e.value === '✓').length,
        missing: marks.filter((e) => e.value === 'M').length
      }
    })

  const assessments = listAssessmentsByClass(classId)
    .filter((a) => !a.assessmentDate || a.assessmentDate <= today)
    .map((a) => {
      const points = listScoresByAssessment(a.id)
        .filter((s) => !s.excused && s.pointsEarned !== null)
        .map((s) => s.pointsEarned as number)
      const average =
        points.length && a.maxScore > 0
          ? (points.reduce((x, y) => x + y, 0) / points.length / a.maxScore) * 100
          : 0
      return { a, scored: points.length, average: Math.round(average) }
    })
    .filter((x) => x.scored >= MIN_SCORES)
    .sort((x, y) =>
      (x.a.assessmentDate ?? x.a.createdAt).localeCompare(y.a.assessmentDate ?? y.a.createdAt)
    )
    .slice(-RECENT_ASSESSMENTS)
    .map((x) => ({ name: short(x.a.name), average: x.average, scored: x.scored }))

  const ticket = getExitTicketByClass(classId)
  const since = addDays(today, -EXIT_TICKET_DAYS)
  const reteach = ticket
    ? summarizeExitTicket(
        ticket.questions,
        listExitTicketResponses(ticket.id).filter((r) => r.submittedAt.slice(0, 10) >= since)
      )
        .filter((q) => q.reteach && q.understood !== null)
        .map((q) => ({
          prompt: short(q.prompt),
          understood: Math.round((q.understood ?? 0) * 100)
        }))
    : []

  return { recentLessons, ladder, assessments, reteach }
}
