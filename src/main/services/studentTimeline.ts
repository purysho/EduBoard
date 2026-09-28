// One student's record in date order, across every class they are or were in:
// joining a class, attendance that wasn't "present", scores, class points (a line a
// day), log notes and parent contacts, handed-in homework, and report card comments.
import { eq } from 'drizzle-orm'
import type { HomeworkSubmission, StudentTimelineEvent } from '@shared/types'
import { countsAsFor, resolveAttendanceCodes } from '@shared/attendanceCodes'
import { resolvePointCategories } from '@shared/pointCategories'
import { tr } from '@shared/i18n'
import { getDb } from '../db/client'
import { homeworkAssignments, homeworkSubmissions } from '../db/schema'
import { listClasses } from '../repositories/classes'
import { listEnrollmentsByStudent } from '../repositories/enrollments'
import { listAttendanceByStudentAndClass } from '../repositories/attendanceRecords'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listScoresByStudentAndClass } from '../repositories/scores'
import { listBehaviourPointsForStudent } from '../repositories/behaviourPoints'
import { listStudentLogEntries } from '../repositories/studentLogEntries'
import { getReportComment } from '../repositories/reportComments'
import { getSettings } from '../repositories/settingsRepo'

const day = (iso: string): string => iso.slice(0, 10)

export function studentTimeline(studentId: string): StudentTimelineEvent[] {
  const settings = getSettings()
  const codes = resolveAttendanceCodes(settings.attendanceCodes)
  const countsAs = countsAsFor(codes)
  const codeLabel = new Map(codes.map((c) => [c.id, c.label]))
  const categoryName = new Map(
    resolvePointCategories(settings.pointCategories).map((c) => [c.id, c.name])
  )
  const classes = new Map(listClasses(true).map((c) => [c.id, c]))
  const events: StudentTimelineEvent[] = []
  const inClass = (classId: string): Pick<StudentTimelineEvent, 'classId' | 'className'> => ({
    classId,
    className: classes.get(classId)?.name ?? null
  })

  for (const enrollment of listEnrollmentsByStudent(studentId)) {
    const classId = enrollment.classId
    if (!classes.has(classId)) continue
    events.push({
      kind: 'enrolled',
      date: day(enrollment.enrolledOn),
      at: enrollment.enrolledOn,
      ...inClass(classId)
    })

    for (const r of listAttendanceByStudentAndClass(studentId, classId)) {
      const status = countsAs(r.status)
      if (status === 'present') continue
      events.push({
        kind: 'attendance',
        date: r.date,
        at: `${r.date}T00:00:00`,
        ...inClass(classId),
        // A code removed from Settings since: what it counted as.
        attendanceLabel: codeLabel.get(r.status) ?? codeLabel.get(status) ?? status,
        attendanceCountsAs: status,
        text: r.note
      })
    }

    const assessments = new Map(listAssessmentsByClass(classId).map((a) => [a.id, a]))
    for (const s of listScoresByStudentAndClass(studentId, classId)) {
      const a = assessments.get(s.assessmentId)
      if (!a || (s.pointsEarned === null && !s.excused)) continue
      const when = a.assessmentDate ?? day(s.updatedAt)
      events.push({
        kind: 'score',
        date: when,
        at: a.assessmentDate ? `${a.assessmentDate}T12:00:00` : s.updatedAt,
        ...inClass(classId),
        assessmentName: a.name,
        pointsEarned: s.pointsEarned,
        maxScore: a.maxScore,
        excused: s.excused,
        text: s.comment
      })
    }

    // Class points: one line per day, totalled by category.
    const byDay = new Map<string, Map<string, number>>()
    for (const p of listBehaviourPointsForStudent(classId, studentId)) {
      const d = day(p.createdAt)
      const name = p.category
        ? (categoryName.get(p.category) ?? tr('Other'))
        : (p.reason ?? tr('Other'))
      if (!byDay.has(d)) byDay.set(d, new Map())
      const totals = byDay.get(d)!
      totals.set(name, (totals.get(name) ?? 0) + p.points)
    }
    for (const [d, totals] of byDay) {
      events.push({
        kind: 'points',
        date: d,
        at: `${d}T23:00:00`,
        ...inClass(classId),
        pointItems: [...totals.entries()]
          .filter(([, total]) => total !== 0)
          .map(([name, total]) => ({ name, total }))
      })
    }

    const comment = getReportComment(classId, studentId)
    if (comment?.text.trim()) {
      events.push({
        kind: 'comment',
        date: day(comment.updatedAt),
        at: comment.updatedAt,
        ...inClass(classId),
        text: comment.text
      })
    }
  }

  const handedIn = getDb()
    .select({
      submission: homeworkSubmissions,
      title: homeworkAssignments.title,
      classId: homeworkAssignments.classId
    })
    .from(homeworkSubmissions)
    .innerJoin(
      homeworkAssignments,
      eq(homeworkSubmissions.homeworkAssignmentId, homeworkAssignments.id)
    )
    .where(eq(homeworkSubmissions.studentId, studentId))
    .all() as { submission: HomeworkSubmission; title: string; classId: string }[]
  for (const h of handedIn) {
    const when = h.submission.submittedAt
    if (!when || !classes.has(h.classId)) continue
    events.push({
      kind: 'homework',
      date: day(when),
      at: when,
      ...inClass(h.classId),
      homeworkTitle: h.title,
      homeworkGrade: h.submission.grade,
      text: h.submission.feedback
    })
  }

  for (const e of listStudentLogEntries(studentId)) {
    events.push({
      kind: 'note',
      date: day(e.createdAt),
      at: e.createdAt,
      classId: null,
      className: null,
      logType: e.type,
      contactMethod: e.contactMethod,
      followUpNeeded: e.followUpNeeded,
      followUpDone: e.followUpDone,
      text: e.text
    })
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}
