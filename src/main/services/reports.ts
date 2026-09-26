import { getClass, listClasses } from '../repositories/classes'
import { listGradeCategories } from '../repositories/gradeCategories'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listScoresByClass, listScoresByStudentAndClass } from '../repositories/scores'
import { getRosterForClass } from '../repositories/enrollments'
import { listAttendanceByClass } from '../repositories/attendanceRecords'
import { listUpcomingLessonPlans } from '../repositories/lessonPlans'
import { listStudents } from '../repositories/students'
import { computeClassGrade, letterForPercent, isPassing } from './grading'
import { computeAttendanceCounts } from './attendance'
import type {
  AnalyticsOverview,
  AttendanceSummary,
  AttendanceWarning,
  CategoryComparisonEntry,
  ClassComparisonEntry,
  ClassReport,
  ClassRosterRow,
  DashboardStats,
  GradeDistributionEntry,
  GradeTrendPoint,
  Score,
  StudentClassGrade
} from '@shared/types'

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
}

const LETTERS = ['A', 'B', 'C', 'D', 'F'] as const

/** Grade for every currently-enrolled student in one class, keyed by student id. */
export function getClassGrades(classId: string): Map<string, StudentClassGrade> {
  const cls = getClass(classId)
  if (!cls) return new Map()

  const categories = listGradeCategories(classId)
  const assessmentsList = listAssessmentsByClass(classId).map((a) => ({
    id: a.id,
    categoryId: a.categoryId,
    maxScore: a.maxScore
  }))
  const scoresByStudent = groupBy(listScoresByClass(classId), (s) => s.studentId)
  const roster = getRosterForClass(classId)

  const result = new Map<string, StudentClassGrade>()
  for (const { student } of roster) {
    const studentScores: Score[] = scoresByStudent.get(student.id) ?? []
    const { percent, categoryBreakdown } = computeClassGrade(
      categories,
      assessmentsList,
      studentScores
    )
    result.set(student.id, {
      studentId: student.id,
      classId,
      percent,
      letter: percent !== null ? letterForPercent(percent, cls.gradeThresholds) : null,
      categoryBreakdown
    })
  }
  return result
}

export function getStudentClassGrade(studentId: string, classId: string): StudentClassGrade | null {
  const grades = getClassGrades(classId)
  return grades.get(studentId) ?? null
}

function attendanceSummaryByStudent(classId: string): Map<string, AttendanceSummary> {
  const recordsByStudent = groupBy(listAttendanceByClass(classId), (r) => r.studentId)
  const result = new Map<string, AttendanceSummary>()
  for (const [studentId, records] of recordsByStudent) {
    const counts = computeAttendanceCounts(records)
    result.set(studentId, { studentId, ...counts })
  }
  return result
}

export function getClassRoster(classId: string): ClassRosterRow[] {
  const roster = getRosterForClass(classId)
  const grades = getClassGrades(classId)
  const attendance = attendanceSummaryByStudent(classId)

  return roster.map(({ student, enrollment }) => ({
    student,
    enrollment,
    grade: grades.get(student.id) ?? {
      studentId: student.id,
      classId,
      percent: null,
      letter: null,
      categoryBreakdown: []
    },
    attendanceRate: attendance.get(student.id)?.rate ?? null
  }))
}

/** One student's scored assessments in one class, oldest first, each as a percent —
 * the raw series a trend chart plots. Excludes excused and not-yet-graded assessments
 * (pointsEarned null), since neither represents a data point on a trajectory. Assessments
 * with no date sort last, since there's no meaningful position for them on a timeline. */
export function getStudentGradeTrend(studentId: string, classId: string): GradeTrendPoint[] {
  const assessmentsById = new Map(listAssessmentsByClass(classId).map((a) => [a.id, a]))
  const scores = listScoresByStudentAndClass(studentId, classId)

  const points: GradeTrendPoint[] = []
  for (const score of scores) {
    if (score.pointsEarned === null || score.excused) continue
    const assessment = assessmentsById.get(score.assessmentId)
    if (!assessment || assessment.maxScore <= 0) continue
    points.push({
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      date: assessment.assessmentDate,
      percent: (score.pointsEarned / assessment.maxScore) * 100
    })
  }

  points.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  return points
}

export function getStudentAttendanceSummary(studentId: string, classId: string): AttendanceSummary {
  const summary = attendanceSummaryByStudent(classId).get(studentId)
  return summary ?? { studentId, present: 0, late: 0, absent: 0, excused: 0, rate: null }
}

export function getClassReport(classId: string): ClassReport | null {
  const cls = getClass(classId)
  if (!cls) return null

  const categories = listGradeCategories(classId)
  const roster = getRosterForClass(classId).filter((r) => r.enrollment.status === 'active')
  const grades = getClassGrades(classId)

  const percents = roster
    .map((r) => grades.get(r.student.id)?.percent ?? null)
    .filter((p): p is number => p !== null)

  const averagePercent = percents.length
    ? percents.reduce((a, b) => a + b, 0) / percents.length
    : null
  const passRate = percents.length
    ? percents.filter((p) => isPassing(p, cls.passMark)).length / percents.length
    : null

  const distributionCounts = new Map<string, number>(LETTERS.map((l) => [l, 0]))
  for (const p of percents) {
    const letter = letterForPercent(p, cls.gradeThresholds)
    distributionCounts.set(letter, (distributionCounts.get(letter) ?? 0) + 1)
  }
  const gradeDistribution: GradeDistributionEntry[] = LETTERS.map((letter) => ({
    letter,
    count: distributionCounts.get(letter) ?? 0,
    share: percents.length ? (distributionCounts.get(letter) ?? 0) / percents.length : 0
  }))

  const categoryAverages = (
    categories.length > 0
      ? categories.map((c) => ({ categoryId: c.id as string | null, categoryName: c.name }))
      : [{ categoryId: null, categoryName: 'General' }]
  ).map(({ categoryId, categoryName }) => {
    const values = roster
      .map(
        (r) =>
          grades.get(r.student.id)?.categoryBreakdown.find((b) => b.categoryId === categoryId)
            ?.percent
      )
      .filter((p): p is number => p !== null && p !== undefined)
    return {
      categoryId,
      categoryName,
      averagePercent: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
    }
  })

  const recordsByDate = groupBy(listAttendanceByClass(classId), (r) => r.date)
  const attendanceTrend = Array.from(recordsByDate.entries())
    .map(([date, records]) => ({ date, rate: computeAttendanceCounts(records).rate }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const attendanceRates = attendanceTrend.map((t) => t.rate).filter((r): r is number => r !== null)
  const averageAttendanceRate = attendanceRates.length
    ? attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length
    : null

  return {
    classId,
    averagePercent,
    passRate,
    averageAttendanceRate,
    gradeDistribution,
    categoryAverages,
    attendanceTrend
  }
}

export function getDashboardStats(): DashboardStats {
  const classes = listClasses()
  const students = listStudents()

  let activeEnrollmentCount = 0
  const allPercents: number[] = []
  let passingCount = 0
  const classAttendanceRates: number[] = []
  let ungradedAssessmentCount = 0

  for (const cls of classes) {
    const roster = getRosterForClass(cls.id)
    const activeRoster = roster.filter((r) => r.enrollment.status === 'active')
    activeEnrollmentCount += activeRoster.length

    const grades = getClassGrades(cls.id)
    for (const { student } of activeRoster) {
      const percent = grades.get(student.id)?.percent
      if (percent !== null && percent !== undefined) {
        allPercents.push(percent)
        if (isPassing(percent, cls.passMark)) passingCount++
      }
    }

    const report = getClassReport(cls.id)
    if (report?.averageAttendanceRate !== null && report?.averageAttendanceRate !== undefined) {
      classAttendanceRates.push(report.averageAttendanceRate)
    }

    const assessmentsList = listAssessmentsByClass(cls.id)
    const scoresList = listScoresByClass(cls.id)
    const gradedStudentsByAssessment = new Map<string, Set<string>>()
    for (const s of scoresList) {
      if (s.pointsEarned !== null || s.excused) {
        const set = gradedStudentsByAssessment.get(s.assessmentId) ?? new Set<string>()
        set.add(s.studentId)
        gradedStudentsByAssessment.set(s.assessmentId, set)
      }
    }
    for (const a of assessmentsList) {
      const gradedCount = gradedStudentsByAssessment.get(a.id)?.size ?? 0
      if (activeRoster.length > 0 && gradedCount < activeRoster.length) ungradedAssessmentCount++
    }
  }

  return {
    classCount: classes.length,
    studentCount: students.length,
    activeEnrollmentCount,
    averagePercent: allPercents.length
      ? allPercents.reduce((a, b) => a + b, 0) / allPercents.length
      : null,
    passRate: allPercents.length ? passingCount / allPercents.length : null,
    averageAttendanceRate: classAttendanceRates.length
      ? classAttendanceRates.reduce((a, b) => a + b, 0) / classAttendanceRates.length
      : null,
    upcomingLessons: listUpcomingLessonPlans(new Date().toISOString().slice(0, 10), 5),
    ungradedAssessmentCount
  }
}

/** Cross-class analytics — every active class's headline numbers side by side, grading
 * categories aggregated by name across classes, and a combined attendance trend. Each
 * class's numbers are just its own `ClassReport`, reused rather than recomputed. */
export function getAnalyticsOverview(): AnalyticsOverview {
  const classes = listClasses().filter((c) => !c.archived)

  const classComparison: ClassComparisonEntry[] = []
  const categoryTotals = new Map<string, { sum: number; count: number; classIds: Set<string> }>()
  const attendanceByDate = new Map<string, { sum: number; count: number }>()

  for (const cls of classes) {
    const report = getClassReport(cls.id)
    if (!report) continue

    classComparison.push({
      classId: cls.id,
      className: cls.name,
      averagePercent: report.averagePercent,
      passRate: report.passRate,
      averageAttendanceRate: report.averageAttendanceRate
    })

    for (const cat of report.categoryAverages) {
      if (cat.averagePercent === null) continue
      const entry = categoryTotals.get(cat.categoryName) ?? {
        sum: 0,
        count: 0,
        classIds: new Set<string>()
      }
      entry.sum += cat.averagePercent
      entry.count += 1
      entry.classIds.add(cls.id)
      categoryTotals.set(cat.categoryName, entry)
    }

    for (const point of report.attendanceTrend) {
      if (point.rate === null) continue
      const entry = attendanceByDate.get(point.date) ?? { sum: 0, count: 0 }
      entry.sum += point.rate
      entry.count += 1
      attendanceByDate.set(point.date, entry)
    }
  }

  const categoryComparison: CategoryComparisonEntry[] = Array.from(categoryTotals.entries())
    .map(([categoryName, { sum, count, classIds }]) => ({
      categoryName,
      averagePercent: count ? sum / count : null,
      classCount: classIds.size
    }))
    .sort((a, b) => (b.averagePercent ?? 0) - (a.averagePercent ?? 0))

  const attendanceTrend = Array.from(attendanceByDate.entries())
    .map(([date, { sum, count }]) => ({ date, rate: count ? sum / count : null }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { classComparison, categoryComparison, attendanceTrend }
}

/** Too few sessions say nothing yet: one absence in week one isn't "40% attendance". */
export const MIN_SESSIONS_FOR_ATTENDANCE_WARNING = 3

/** Students under their class's attendance minimum, across every active class that has
 * one set, lowest first. Only active enrollments count, and excused absences don't. */
export function getAttendanceWarnings(): AttendanceWarning[] {
  const warnings: AttendanceWarning[] = []
  for (const cls of listClasses(false)) {
    if (cls.minAttendance === null || cls.minAttendance === undefined) continue
    const summary = attendanceSummaryByStudent(cls.id)
    for (const { student, enrollment } of getRosterForClass(cls.id)) {
      if (enrollment.status !== 'active') continue
      const s = summary.get(student.id)
      if (!s || s.rate === null) continue
      const sessions = s.present + s.late + s.absent
      if (sessions < MIN_SESSIONS_FOR_ATTENDANCE_WARNING) continue
      if (s.rate * 100 >= cls.minAttendance) continue
      warnings.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        classId: cls.id,
        className: cls.name,
        rate: s.rate,
        minAttendance: cls.minAttendance,
        absent: s.absent,
        sessions
      })
    }
  }
  return warnings.sort((a, b) => a.rate - b.rate)
}
