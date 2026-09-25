import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  BookOpenText,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  History,
  Layers,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Users
} from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { usePortalMessageThreads, useSettings } from '@renderer/lib/queries'

// Grouped so fourteen destinations scan as four short lists instead of one long one.
const navGroups: {
  heading: string | null
  items: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }[]
}[] = [
  {
    heading: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
      { to: '/classes', label: 'Classes', icon: GraduationCap },
      { to: '/students', label: 'Students', icon: Users }
    ]
  },
  {
    heading: 'Teaching',
    items: [
      { to: '/calendar', label: 'Calendar', icon: Calendar },
      { to: '/timetable', label: 'Timetable', icon: CalendarDays },
      { to: '/resources', label: 'Resources', icon: FolderOpen },
      { to: '/notebook', label: 'Notebook', icon: BookOpenText }
    ]
  },
  {
    heading: 'Grading',
    items: [
      { to: '/rubrics', label: 'Rubrics', icon: ClipboardCheck },
      { to: '/composite-grades', label: 'Composite Grades', icon: Layers },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 }
    ]
  },
  {
    heading: 'Families & students',
    items: [
      { to: '/messages', label: 'Messages', icon: MessageSquare },
      { to: '/communications', label: 'Communications', icon: MessageCircle }
    ]
  },
  {
    heading: 'Admin',
    items: [
      { to: '/audit-log', label: 'Audit Log', icon: History },
      { to: '/settings', label: 'Settings', icon: Settings2 }
    ]
  }
]

export function Sidebar(): React.JSX.Element {
  // Only poll once a Portal is configured — otherwise every 15s poll throws
  // PortalNotConfiguredError in the main process and floods the dev console. No badge
  // is a perfectly normal state here, not worth surfacing.
  const { data: settings } = useSettings()
  const portalConfigured = Boolean(settings?.portalUrl.trim() && settings?.portalSyncSecret.trim())
  const { data: threads } = usePortalMessageThreads({ enabled: portalConfigured })
  const unreadMessages = threads?.reduce((sum, t) => sum + t.unread, 0) ?? 0

  return (
    <aside className="no-print flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-sm font-bold text-white shadow-sm">
          EB
        </div>
        <span className="text-base font-semibold tracking-tight text-[var(--color-text)]">
          EduBoard
        </span>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {navGroups.map((group) => (
          <div key={group.heading ?? 'main'} className="flex flex-col gap-0.5">
            {group.heading && (
              <p className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {group.heading}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'absolute left-0 h-5 w-0.5 rounded-full bg-[var(--color-primary)] transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    <item.icon size={17} strokeWidth={2} aria-hidden />
                    {item.label}
                    {item.to === '/messages' && unreadMessages > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[10px] font-semibold text-white">
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-1.5 px-5 py-4 text-xs text-[var(--color-text-muted)]">
        <ShieldCheck size={14} aria-hidden />
        Your data stays on this device
      </div>
    </aside>
  )
}
