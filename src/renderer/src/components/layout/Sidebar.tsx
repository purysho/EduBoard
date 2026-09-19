import { NavLink } from 'react-router-dom'
import { cn } from '@renderer/lib/cn'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◧', end: true },
  { to: '/classes', label: 'Classes', icon: '▤' },
  { to: '/students', label: 'Students', icon: '◍' },
  { to: '/settings', label: 'Settings', icon: '⚙' }
]

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
          EB
        </div>
        <span className="text-base font-semibold text-[var(--color-text)]">EduBoard</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
              )
            }
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-5 py-4 text-xs text-[var(--color-text-muted)]">
        Your data stays on this device.
      </div>
    </aside>
  )
}
