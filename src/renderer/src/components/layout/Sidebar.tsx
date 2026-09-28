import { appInitials, displayAppName, PRODUCT_NAME } from '@shared/branding'
import { Link, NavLink } from 'react-router-dom'
import {
  ArrowUpCircle,
  Lock,
  Newspaper,
  Projector,
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
import { setPresenting, usePresenting } from '@renderer/lib/presenting'
import {
  useAppUpdateStatus,
  usePortalMessageThreads,
  useSecurityStatus,
  useSettings
} from '@renderer/lib/queries'
import { tr, uiLanguage } from '@shared/i18n'

// Grouped so fourteen destinations scan as four short lists instead of one long one.
const navGroups: {
  heading: string | null
  items: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }[]
}[] = [
  {
    heading: null,
    items: [
      { to: '/', label: tr('Dashboard'), icon: LayoutGrid, end: true },
      { to: '/classes', label: tr('Classes'), icon: GraduationCap },
      { to: '/students', label: tr('Students'), icon: Users }
    ]
  },
  {
    heading: tr('Teaching'),
    items: [
      { to: '/calendar', label: tr('Calendar'), icon: Calendar },
      { to: '/timetable', label: tr('Timetable'), icon: CalendarDays },
      { to: '/resources', label: tr('Resources'), icon: FolderOpen },
      { to: '/notebook', label: tr('Notebook'), icon: BookOpenText }
    ]
  },
  {
    heading: tr('Grading'),
    items: [
      { to: '/rubrics', label: tr('Rubrics'), icon: ClipboardCheck },
      { to: '/composite-grades', label: tr('Composite Grades'), icon: Layers },
      { to: '/analytics', label: tr('Analytics'), icon: BarChart3 }
    ]
  },
  {
    heading: tr('Families & students'),
    items: [
      { to: '/messages', label: tr('Messages'), icon: MessageSquare },
      { to: '/communications', label: tr('Communications'), icon: MessageCircle },
      { to: '/newsletter', label: tr('Newsletter'), icon: Newspaper }
    ]
  },
  {
    heading: tr('Admin'),
    items: [
      { to: '/audit-log', label: tr('Audit Log'), icon: History },
      { to: '/settings', label: tr('Settings'), icon: Settings2 }
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
  // Stays until the new version is running: downloading, waiting to install, or (when
  // this copy can't update itself) simply available.
  const { data: update } = useAppUpdateStatus()
  const { data: security } = useSecurityStatus()
  const presenting = usePresenting()
  const updateLabel = !update?.updateAvailable
    ? null
    : update.readyVersion
      ? tr('EduBoard {version} is ready to install', { version: update.readyVersion })
      : update.downloading !== null
        ? tr('Downloading EduBoard {version}… {percent}%', {
            version: update.latest,
            percent: Math.round(update.downloading * 100)
          })
        : tr('EduBoard {version} is available', { version: update.latest })

  const appName = displayAppName(settings)
  return (
    <aside className="no-print flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {settings?.schoolLogo ? (
          <img
            src={settings.schoolLogo}
            alt=""
            className="h-9 w-9 shrink-0 rounded-xl object-contain"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-sm font-bold text-white shadow-sm">
            {appInitials(appName)}
          </div>
        )}
        <span className="min-w-0 leading-tight">
          <span
            className={cn(
              'line-clamp-2 block font-semibold tracking-tight break-words text-[var(--color-text)]',
              appName.length > 14 ? 'text-sm' : 'text-base'
            )}
          >
            {appName === PRODUCT_NAME ? tr('EduBoard') : appName}
          </span>
          {settings?.schoolName && (
            <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
              {settings.schoolName}
            </span>
          )}
        </span>
        <button
          onClick={() => setPresenting(!presenting)}
          title={
            presenting
              ? tr('Stop presenting')
              : tr('Present: hide grades, notes and contact details')
          }
          aria-label={presenting ? tr('Stop presenting') : tr('Present on a projector')}
          aria-pressed={presenting}
          className={cn(
            'rounded-lg p-1.5 hover:bg-[var(--color-surface-muted)]',
            !updateLabel && 'ml-auto',
            presenting ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'
          )}
        >
          <Projector size={18} aria-hidden />
        </button>
        {!presenting && updateLabel && (
          <Link
            to="/settings?section=updates"
            title={updateLabel}
            aria-label={updateLabel}
            className="relative rounded-lg p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
          >
            <ArrowUpCircle
              size={18}
              aria-hidden
              className={
                update?.downloading !== null && !update?.readyVersion ? 'animate-pulse' : ''
              }
            />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--color-danger)]" />
          </Link>
        )}
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
                    {item.to === '/settings' && updateLabel && !presenting && (
                      <span
                        className="ml-auto h-2 w-2 rounded-full bg-[var(--color-danger)]"
                        title={updateLabel}
                        aria-label={updateLabel}
                      />
                    )}
                    {item.to === '/messages' && unreadMessages > 0 && !presenting && (
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
        <span className="flex-1">{tr('Your data stays on this device')}</span>
        <button
          onClick={async () => {
            await window.api.settings.update({ uiLanguage: uiLanguage() === 'zh' ? 'en' : 'zh' })
            location.reload()
          }}
          title={uiLanguage() === 'zh' ? tr('Switch to English') : '切换到中文'}
          aria-label={uiLanguage() === 'zh' ? tr('Switch to English') : '切换到中文'}
          className="rounded-md px-1 py-0.5 font-medium hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
        >
          {uiLanguage() === 'zh' ? 'EN' : '中文'}
        </button>
        {security?.protected && (
          <button
            onClick={() => void window.api.security.lock()}
            title={tr('Lock EduBoard now')}
            aria-label={tr('Lock EduBoard now')}
            className="rounded-md p-1 hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
          >
            <Lock size={14} aria-hidden />
          </button>
        )}
      </div>
    </aside>
  )
}
