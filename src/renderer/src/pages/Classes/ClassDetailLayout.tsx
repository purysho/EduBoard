import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Target,
  FileCheck2,
  LayoutGrid,
  MonitorSmartphone,
  Presentation,
  Newspaper,
  NotebookPen,
  Settings2,
  Ticket,
  Users
} from 'lucide-react'
import { useClass, useTerms } from '@renderer/lib/queries'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { cn } from '@renderer/lib/cn'
import { tr } from '@shared/i18n'

const TABS = [
  // Day-to-day tabs first; occasional ones (exit tickets, seating, reports) further right.
  { to: '', label: tr('Roster'), icon: Users, end: true },
  { to: 'gradebook', label: tr('Gradebook'), icon: ClipboardList },
  { to: 'competencies', label: tr('Competencies'), icon: Target },
  { to: 'homework', label: tr('Homework'), icon: FileCheck2 },
  { to: 'attendance', label: tr('Attendance'), icon: CalendarCheck },
  { to: 'lessons', label: tr('Lesson plans'), icon: NotebookPen },
  { to: 'story', label: tr('Class Story'), icon: Newspaper },
  { to: 'portal', label: tr('Portal'), icon: Ticket },
  { to: 'classroom', label: tr('Classroom'), icon: Presentation },
  { to: 'exit-ticket', label: tr('Exit ticket'), icon: MonitorSmartphone },
  { to: 'seating', label: tr('Seating chart'), icon: LayoutGrid },
  { to: 'report', label: tr('Report'), icon: BarChart3 },
  { to: 'settings', label: tr('Settings'), icon: Settings2 }
]

export function ClassDetailLayout(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>()
  const { data: classSection, isLoading } = useClass(classId)
  const { data: terms } = useTerms()

  if (isLoading) return <Spinner />
  if (!classSection) return <EmptyState title={tr('Class not found')} />

  const term = terms?.find((t) => t.id === classSection.termId)

  return (
    <div>
      <Link
        to="/classes"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        <ArrowLeft size={14} aria-hidden />
        {tr('All classes')}
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{classSection.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {[classSection.subject, classSection.gradeLevel, term?.name, classSection.schedule]
              .filter(Boolean)
              .join(' · ') || tr('No details yet')}
          </p>
        </div>
      </div>

      {/* Wraps onto a second row when the window is narrow, so every tab stays in sight
          (scrolling sideways hid the last few, where nobody found them). */}
      <div className="mb-6 flex flex-wrap gap-x-1 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )
            }
          >
            <tab.icon size={15} aria-hidden />
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ classSection }} />
    </div>
  )
}
