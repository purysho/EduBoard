import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '@renderer/components/ui/Badge'
import { letterTone } from '@renderer/lib/grade'
import { Spinner } from '@renderer/components/ui/EmptyState'
import {
  useAssessments,
  useClasses,
  useGradeCategories,
  useScoresByStudentClass,
  useSettings,
  useStudentAttendanceSummary,
  useStudentClassGrade,
  useStudents
} from '@renderer/lib/queries'
import { formatDate, formatPercent, formatRate, studentFullName } from '@renderer/lib/format'

export function StudentReportPrintPage(): React.JSX.Element {
  const { studentId, classId } = useParams<{ studentId: string; classId: string }>()

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
    settingsLoading

  useEffect(() => {
    if (!loading && student && classSection) {
      document.title = 'eduboard-print-ready'
    }
  }, [loading, student, classSection])

  if (loading) return <Spinner />
  if (!student || !classSection) return <p className="p-8">Report not available.</p>

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-slate-900">
      <div className="mb-6 flex items-start justify-between border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold">{classSection.name}</h1>
          <p className="text-sm text-slate-500">
            Student report — {formatDate(new Date().toISOString())}
          </p>
        </div>
        {(settings?.schoolName || settings?.teacherName) && (
          <div className="text-right text-sm text-slate-500">
            {settings.schoolName && <p>{settings.schoolName}</p>}
            {settings.teacherName && <p>{settings.teacherName}</p>}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs uppercase text-slate-500">Student</p>
          <p className="text-base font-medium">{studentFullName(student)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Overall grade</p>
          <p className="text-base font-medium">
            {formatPercent(grade?.percent ?? null)}{' '}
            {grade?.letter && <Badge tone={letterTone(grade.letter)}>{grade.letter}</Badge>}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Attendance</p>
          <p className="text-base font-medium">{formatRate(attendance?.rate ?? null)}</p>
        </div>
      </div>

      {!!grade?.categoryBreakdown.length && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
            Category breakdown
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
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Assessments</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5">Assessment</th>
              <th className="py-1.5">Category</th>
              <th className="py-1.5">Date</th>
              <th className="py-1.5 text-right">Score</th>
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
                      ? 'Excused'
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

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Attendance summary</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1">Present</td>
              <td className="py-1 text-right">{attendance?.present ?? 0}</td>
            </tr>
            <tr>
              <td className="py-1">Late</td>
              <td className="py-1 text-right">{attendance?.late ?? 0}</td>
            </tr>
            <tr>
              <td className="py-1">Absent</td>
              <td className="py-1 text-right">{attendance?.absent ?? 0}</td>
            </tr>
            <tr>
              <td className="py-1">Excused</td>
              <td className="py-1 text-right">{attendance?.excused ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
