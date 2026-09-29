import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Brush,
  ClipboardList,
  FileBarChart,
  Globe,
  LifeBuoy,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/cn'
import { TermsPanel } from './TermsPanel'
import { ImportPanel } from './ImportPanel'
import { BackupPanel } from './BackupPanel'
import { PortalPanel } from './PortalPanel'
import { AboutPanel } from './AboutPanel'
import { SecurityPanel } from './SecurityPanel'
import { AppearancePanel } from './AppearancePanel'
import { GradingDefaultsPanel } from './GradingDefaultsPanel'
import { ReportCardPanel } from './ReportCardPanel'
import {
  AttendanceCodesCard,
  CommentBankCard,
  PointCategoriesCard,
  QuickAddsCard,
  SavedTemplatesCard,
  StudentFieldsCard,
  TerminologyCard
} from './ListsPanel'
import {
  DigestCard,
  PortalConnectionCard,
  PortalScoresCard,
  ProfileCard,
  StudentAiCard,
  TeacherAiCard
} from './SettingsForms'
import { GroupChatsPanel } from './GroupChatsPanel'
import { UsagePingPanel } from './UsagePingPanel'
import { HelpPanel } from './HelpPanel'
import { SampleSchoolCard } from './SampleSchoolCard'
import { SchoolPackPanel } from './SchoolPackPanel'
import { CoursePackPanel } from './CoursePackPanel'
import { tr } from '@shared/i18n'

interface Section {
  id: string
  label: string
  /** One line under the label in the menu. */
  blurb: string
  /** Extra words the search box matches (both what's on the cards and what people call them). */
  keywords: string
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  content: () => React.JSX.Element
}

const SECTIONS: Section[] = [
  {
    id: 'general',
    label: tr('You and your school'),
    blurb: tr('Name, email, language, theme'),
    keywords: tr('name school email language theme dark mode'),
    icon: UserRound,
    content: () => <ProfileCard />
  },
  {
    id: 'appearance',
    label: tr('Appearance'),
    blurb: tr('Logo, colour, text size, stylesheet'),
    keywords: tr('logo colour color text size contrast motion stylesheet css'),
    icon: Brush,
    content: () => <AppearancePanel />
  },
  {
    id: 'grading',
    label: tr('Grading and reports'),
    blurb: tr('Grading scale, terms, report cards, comment bank'),
    keywords: tr('grade scale pass mark terms report card layout comment bank sentences'),
    icon: FileBarChart,
    content: () => (
      <>
        <GradingDefaultsPanel />
        <TermsPanel />
        <ReportCardPanel />
        <CommentBankCard />
      </>
    )
  },
  {
    id: 'lists',
    label: tr('Class lists'),
    blurb: tr('Attendance codes, class points, student fields, words'),
    keywords: tr(
      'attendance codes class points categories quick add log buttons student fields allergies words terminology templates'
    ),
    icon: ClipboardList,
    content: () => (
      <>
        <AttendanceCodesCard />
        <PointCategoriesCard />
        <StudentFieldsCard />
        <QuickAddsCard />
        <TerminologyCard />
        <SavedTemplatesCard />
      </>
    )
  },
  {
    id: 'portal',
    label: tr('Portal and families'),
    blurb: tr('Portal connection, digest email, group chats'),
    keywords: tr(
      'portal sync secret publish accounts password reset scores assessments comments class average digest email smtp newsletter dingtalk wecom group chat'
    ),
    icon: Globe,
    content: () => (
      <>
        <PortalConnectionCard />
        <PortalPanel />
        <PortalScoresCard />
        <DigestCard />
        <GroupChatsPanel />
      </>
    )
  },
  {
    id: 'ai',
    label: tr('AI'),
    blurb: tr('Your AI key, and AI for students'),
    keywords: tr('ai key provider deepseek qwen zhipu anthropic ollama students study helper'),
    icon: Sparkles,
    content: () => (
      <>
        <TeacherAiCard />
        <StudentAiCard />
      </>
    )
  },
  {
    id: 'data',
    label: tr('Data and security'),
    blurb: tr('Backups, password, imports and packs'),
    keywords: tr(
      'backup restore password lock encryption import roster excel school pack course pack curriculum export'
    ),
    icon: ShieldCheck,
    content: () => (
      <>
        <BackupPanel />
        <SecurityPanel />
        <ImportPanel />
        <CoursePackPanel />
        <SchoolPackPanel />
      </>
    )
  },
  {
    id: 'help',
    label: tr('Help and updates'),
    blurb: tr('Version, updates, sample school, error report'),
    keywords: tr('version update help error report code log usage improve sample demo try'),
    icon: LifeBuoy,
    content: () => (
      <>
        <AboutPanel />
        <SampleSchoolCard />
        <HelpPanel />
        <UsagePingPanel />
      </>
    )
  }
]

/** Older links used other names for some sections. */
const ALIASES: Record<string, string> = { updates: 'help' }

export function SettingsPage(): React.JSX.Element {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const location = useLocation()
  const [query, setQuery] = useState('')

  const params = new URLSearchParams(location.search)
  const asked = params.get('section') ?? 'general'
  // "focus" scrolls to one card in the section (e.g. the Getting started step for terms).
  const focus = params.get('focus')
  useEffect(() => {
    if (!focus || isLoading) return
    const el = document.getElementById(`settings-${focus}`)
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus, isLoading])
  const current = SECTIONS.find((s) => s.id === (ALIASES[asked] ?? asked)) ?? SECTIONS[0]

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return SECTIONS
    return SECTIONS.filter((s) => {
      const text = `${s.label} ${s.blurb} ${s.keywords}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
  }, [query])

  if (isLoading || !settings) return <Spinner />
  const Content = current.content

  return (
    <div>
      <PageHeader
        title={tr('Settings')}
        actions={
          settings.onboardingDismissed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateSettings.mutate({ onboardingDismissed: false })}
            >
              {tr('Show getting-started checklist')}
            </Button>
          ) : null
        }
      />

      <div className="flex items-start gap-6">
        <nav aria-label={tr('Settings sections')} className="sticky top-4 w-60 shrink-0 space-y-3">
          <label className="relative block">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-2.5 text-[var(--color-text-muted)]"
              aria-hidden
            />
            <input
              type="search"
              aria-label={tr('Search settings')}
              placeholder={tr('Search settings')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-2 text-sm"
            />
          </label>
          <ul className="space-y-0.5">
            {matches.map((s) => {
              const active = s.id === current.id
              const Icon = s.icon
              return (
                <li key={s.id}>
                  <Link
                    to={`/settings?section=${s.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex gap-2.5 rounded-md px-2.5 py-2',
                      active
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'hover:bg-[var(--color-surface-muted)]'
                    )}
                  >
                    <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {s.blurb}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
            {matches.length === 0 && (
              <li className="px-2.5 py-2 text-xs text-[var(--color-text-muted)]">
                {tr('Nothing matches “{query}”.', { query })}
              </li>
            )}
          </ul>
        </nav>

        <section aria-labelledby="settings-section-title" className="min-w-0 flex-1 space-y-6">
          <h2 id="settings-section-title" className="text-lg font-semibold">
            {current.label}
          </h2>
          <Content />
        </section>
      </div>
    </div>
  )
}
