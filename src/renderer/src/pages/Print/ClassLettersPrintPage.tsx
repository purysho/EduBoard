import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { fillLetter } from '@shared/letters'
import { uiLocale } from '@shared/i18n'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { useClassRoster, useClasses, useSettings } from '@renderer/lib/queries'

/** /print/letters/:classId — the parent letter template filled in for every active
 * student, a page each, for printing to PDF. */
export function ClassLettersPrintPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>()
  const { data: roster, isLoading: rosterLoading } = useClassRoster(classId)
  const { data: classes, isLoading: classesLoading } = useClasses(true)
  const { data: settings, isLoading: settingsLoading } = useSettings()
  const loading = rosterLoading || classesLoading || settingsLoading

  useEffect(() => {
    if (!loading) document.title = 'eduboard-print-ready'
  }, [loading])

  if (loading || !settings) return <Spinner />
  const cls = classes?.find((c) => c.id === classId)
  const date = new Date().toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const rows = (roster ?? [])
    .filter((r) => r.enrollment.status === 'active')
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName))

  return (
    <>
      {rows.map((r) => (
        <div
          key={r.student.id}
          className="mx-auto max-w-3xl break-after-page bg-white p-12 text-[15px] leading-relaxed text-slate-900"
        >
          <div className="mb-10 flex items-start justify-between">
            <div className="text-sm text-slate-500">
              {settings.schoolName && (
                <p className="font-medium text-slate-700">{settings.schoolName}</p>
              )}
              <p>{date}</p>
            </div>
            {settings.schoolLogo && (
              <img src={settings.schoolLogo} alt="" className="h-16 w-16 object-contain" />
            )}
          </div>
          <p className="whitespace-pre-wrap">
            {fillLetter(settings.letterTemplate, {
              name: r.student.preferredName?.trim() || r.student.firstName,
              guardian: r.student.guardianName,
              className: cls?.name ?? '',
              grade: r.grade.letter,
              percent: r.grade.percent,
              attendanceRate: r.attendanceRate,
              teacher: settings.teacherName,
              school: settings.schoolName,
              date
            })}
          </p>
        </div>
      ))}
    </>
  )
}
