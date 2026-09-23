import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Layers,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Users
} from 'lucide-react'
import { cn } from '@renderer/lib/cn'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/classes', label: 'Classes', icon: GraduationCap },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/rubrics', label: 'Rubrics', icon: ClipboardCheck },
  { to: '/resources', label: 'Resources', icon: FolderOpen },
  { to: '/notebook', label: 'Notebook', icon: BookOpenText },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/communications', label: 'Communications', icon: MessageCircle },
  { to: '/composite-grades', label: 'Composite Grades', icon: Layers },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings2 }
]

export function Sidebar(): React.JSX.Element {
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
      <nav className="flex flex-col gap-0.5 px-3">
        {navItems.map((item) => (
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
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-1.5 px-5 py-4 text-xs text-[var(--color-text-muted)]">
        <ShieldCheck size={14} aria-hidden />
        Your data stays on this device
      </div>
    </aside>
  )
}
