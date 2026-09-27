import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@renderer/components/ui/Badge'
import { letterTone } from '@renderer/lib/grade'
import { Spinner } from '@renderer/components/ui/EmptyState'
import {
  useAssessments,
  useClasses,
  useGradeCategories,
  useScoresByStudentClass,
  useSettings,
  useClassRoster,
  useStudentAttendanceSummary,
  useStudentClassGrade,
  useStudents
} from '@renderer/lib/queries'
import { formatDate, formatPercent, formatRate, studentFullName } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

/** One student's report card for one class, as printed. `onReady` fires once
 * everything it shows has loaded, so a print can wait for it. */
export function ReportCard({
  studentId,
  classId,
  onReady
}: {
  studentId: string
  classId: string
  onReady: () => void
}): React.JSX.Element {
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['reportComments', classId],
    queryFn: () => window.api.reportComments.list(classId)
  })
  const comment = comments?.find((c) => c.studentId === studentId)?.text

  const { data: students, isLoading: studentsLoading } = useStudents(true)
  const { data: classes, isLoading: classesLoading } = useClasses(true)
  const { data: grade, isLoading: gradeLoading } = useStudentClassGrade(studentId, classId)
  const { data: attendance, isLoading: attendanceLoading } = useStudentAttendanceSummary(
    studentId,
    classId
  )
  const { data: assessments, isLoading: assessmentsLoading } = useAssessments(classId)
  const { data: scores, isLoading: scoresLoading } = useScoresByStudentClass(studentId, classId)
  const { data: categories } = useGradeCategories(classId)
  const { data: settings, isLoading: settingsLoading } = useSettings()

  const student = students?.find((s) => s.id === studentId)
  const classSection = classes?.find((c) => c.id === classId)

  const scoreByAssessment = useMemo(
    () => new Map((scores ?? []).map((s) => [s.assessmentId, s])),
    [scores]
  )
  const categoryName = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories]
  )

  const loading =
    studentsLoading ||
    classesLoading ||
    gradeLoading ||
    attendanceLoading ||
    assessmentsLoading ||
    scoresLoading ||
    settingsLoading ||
    commentsLoading

  useEffect(() => {
    if (!loading) onReady()
  }, [loading, onReady])

  if (loading) return <Spinner />
  if (!student || !classSection) return <p className="p-8">{tr('Report not available.')}</p>

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-slate-900 break-after-page">
      <div className="mb-6 flex items-start justify-between border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold">{classSection.name}</h1>
          <p className="text-sm text-slate-500">
            {tr('Student report — {date}', { date: formatDate(new Date().toISOString()) })}
          </p>
        </div>
        {(settings?.schoolName || settings?.teacherName || settings?.schoolLogo) && (
          <div className="flex items-start gap-3 text-right text-sm text-slate-500">
            <div>
              {settings.schoolName && <p>{settings.schoolName}</p>}
              {settings.teacherName && <p>{settings.teacherName}</p>}
            </div>
            {settings.schoolLogo && (
              <img src={settings.schoolLogo} alt="" className="h-14 w-14 object-contain" />
            )}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs uppercase text-slate-500">{tr('Student')}</p>
          <p className="text-base font-medium">{studentFullName(student)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">{tr('Overall grade')}</p>
          <p className="text-base font-medium">
            {formatPercent(grade?.percent ?? null)}{' '}
            {grade?.letter && (
              <Badge tone={letterTone(grade.letter, classSection.gradeThresholds)}>
                {grade.letter}
              </Badge>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">{tr('Attendance')}</p>
          <p className="text-base font-medium">{formatRate(attendance?.rate ?? null)}</p>
        </div>
      </div>

      {!!grade?.categoryBreakdown.length && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
            {tr('Category breakdown')}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {grade.categoryBreakdown.map((c, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="py-1.5">{c.categoryName}</td>
                  <td className="py-1.5 text-right">{formatPercent(c.percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">{tr('Assessments')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5">{tr('Assessment')}</th>
              <th className="py-1.5">{tr('Category')}</th>
              <th className="py-1.5">{tr('Date')}</th>
              <th className="py-1.5 text-right">{tr('Score')}</th>
            </tr>
          </thead>
          <tbody>
            {(assessments ?? []).map((a) => {
              const score = scoreByAssessment.get(a.id)
              return (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-slate-500">
                    {a.categoryId ? categoryName.get(a.categoryId) : '—'}
                  </td>
                  <td className="py-1.5 text-slate-500">{formatDate(a.assessmentDate)}</td>
                  <td className="py-1.5 text-right">
                    {score?.excused
                      ? tr('Excused')
                      : score?.pointsEarned != null
                        ? `${score.pointsEarned}/${a.maxScore}`
                        : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {comment && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">{tr('Comment')}</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment}</p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          {tr('Attendance summary')}
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1">{tr('Present')}</td>
              <td className="py-1 text-right">{attendance?.present ?? 0}</td>
            </tr>
            <tr>
              <td className="py-1">{tr('Late')}</td>
              <td className="py-1 text-right">{attendance?.late ?? 0}</td>
            </tr>
            <tr>
              <td className="py-1">{tr('Absent')}</td>
              <td className="py-1 text-right">{attendance?.absent ?? 0}</td>
            </tr>
            <tr>
              <td className="py-1">{tr('Excused')}</td>
              <td className="py-1 text-right">{attendance?.excused ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const markReady = (): void => {
  document.title = 'eduboard-print-ready'
}

/** /print/student/:studentId/:classId — one report card, for printing to PDF. */
export function StudentReportPrintPage(): React.JSX.Element {
  const { studentId, classId } = useParams<{ studentId: string; classId: string }>()
  return <ReportCard studentId={studentId!} classId={classId!} onReady={markReady} />
}

/** /print/class/:classId — every active student's report card, a page each. */
export function ClassReportsPrintPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>()
  const { data: roster, isLoading } = useClassRoster(classId)
  const students = (roster ?? [])
    .filter((r) => r.enrollment.status === 'active')
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName))
  const ready = useRef(new Set<string>())
  const onReadyFor = useCallback(
    (id: string) => () => {
      ready.current.add(id)
      if (ready.current.size >= students.length) markReady()
    },
    [students.length]
  )
  useEffect(() => {
    if (!isLoading && students.length === 0) markReady()
  }, [isLoading, students.length])
  if (isLoading) return <Spinner />
  return (
    <>
      {students.map((r) => (
        <ReportCard
          key={r.student.id}
          studentId={r.student.id}
          classId={classId!}
          onReady={onReadyFor(r.student.id)}
        />
      ))}
    </>
  )
}
