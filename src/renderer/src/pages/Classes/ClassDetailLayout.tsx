import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  NotebookPen,
  Settings2,
  Users
} from 'lucide-react'
import { useClass, useTerms } from '@renderer/lib/queries'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { cn } from '@renderer/lib/cn'

const TABS = [
  { to: '', label: 'Roster', icon: Users, end: true },
  { to: 'gradebook', label: 'Gradebook', icon: ClipboardList },
  { to: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { to: 'lessons', label: 'Lesson plans', icon: NotebookPen },
  { to: 'report', label: 'Report', icon: BarChart3 },
  { to: 'settings', label: 'Settings', icon: Settings2 }
]

export function ClassDetailLayout(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>()
  const { data: classSection, isLoading } = useClass(classId)
  const { data: terms } = useTerms()

  if (isLoading) return <Spinner />
  if (!classSection) return <EmptyState title="Class not found" />

  const term = terms?.find((t) => t.id === classSection.termId)

  return (
    <div>
      <Link
        to="/classes"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        <ArrowLeft size={14} aria-hidden />
        All classes
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{classSection.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {[classSection.subject, classSection.gradeLevel, term?.name, classSection.schedule]
              .filter(Boolean)
              .join(' · ') || 'No details yet'}
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
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
