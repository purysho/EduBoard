import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarX,
  ClipboardCheck,
  GraduationCap,
  History,
  MessageCircle,
  MessageSquareText,
  NotebookPen,
  Star,
  UserPlus
} from 'lucide-react'
import type { Student, StudentTimelineEvent } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { usePortalMessageThreads, useSettings } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { tr } from '@shared/i18n'

/** What the filter chips group: each chip shows or hides some kinds of event. */
type Group = 'attendance' | 'scores' | 'points' | 'notes' | 'homework' | 'comments' | 'messages'

interface Row {
  group: Group
  date: string
  at: string
  className: string | null
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  tone: 'good' | 'bad' | 'neutral'
  title: string
  text?: string | null
}

const PAGE = 60

const GROUPS: { id: Group; label: () => string }[] = [
  { id: 'attendance', label: () => tr('Attendance') },
  { id: 'scores', label: () => tr('Scores') },
  { id: 'points', label: () => tr('Class points') },
  { id: 'notes', label: () => tr('Notes and contacts') },
  { id: 'homework', label: () => tr('Homework') },
  { id: 'comments', label: () => tr('Report comments') },
  { id: 'messages', label: () => tr('Messages') }
]

function logTitle(e: StudentTimelineEvent): string {
  if (e.logType === 'contact') {
    const how =
      { phone: tr('phone'), email: tr('email'), 'in-person': tr('in person'), other: tr('other') }[
        e.contactMethod ?? 'other'
      ] ?? ''
    return tr('Parent contact ({how})', { how })
  }
  return (
    { note: tr('Note'), positive: tr('Positive note'), concern: tr('Concern') }[
      e.logType ?? 'note'
    ] ?? tr('Note')
  )
}

function toRow(e: StudentTimelineEvent): Row {
  const base = { date: e.date, at: e.at, className: e.className, text: e.text }
  switch (e.kind) {
    case 'enrolled':
      return {
        ...base,
        group: 'notes',
        icon: UserPlus,
        tone: 'neutral',
        title: tr('Joined the class')
      }
    case 'attendance':
      return {
        ...base,
        group: 'attendance',
        icon: CalendarX,
        tone: e.attendanceCountsAs === 'excused' ? 'neutral' : 'bad',
        title: e.attendanceLabel ?? ''
      }
    case 'score': {
      const pct =
        e.pointsEarned != null && e.maxScore
          ? Math.round((100 * e.pointsEarned) / e.maxScore)
          : null
      return {
        ...base,
        group: 'scores',
        icon: GraduationCap,
        tone: pct === null ? 'neutral' : pct >= 70 ? 'good' : pct < 50 ? 'bad' : 'neutral',
        title: e.excused
          ? tr('{name}: excused', { name: e.assessmentName ?? '' })
          : tr('{name}: {points} / {max} ({pct}%)', {
              name: e.assessmentName ?? '',
              points: e.pointsEarned ?? '',
              max: e.maxScore ?? '',
              pct: pct ?? ''
            })
      }
    }
    case 'points': {
      const items = e.pointItems ?? []
      const net = items.reduce((sum, i) => sum + i.total, 0)
      return {
        ...base,
        group: 'points',
        icon: Star,
        tone: net > 0 ? 'good' : net < 0 ? 'bad' : 'neutral',
        title: items.map((i) => `${i.total > 0 ? '+' : ''}${i.total} ${i.name}`).join(' · ')
      }
    }
    case 'note':
      return {
        ...base,
        group: 'notes',
        icon: NotebookPen,
        tone: e.logType === 'positive' ? 'good' : e.logType === 'concern' ? 'bad' : 'neutral',
        title:
          logTitle(e) + (e.followUpNeeded && !e.followUpDone ? ` · ${tr('follow-up needed')}` : '')
      }
    case 'homework':
      return {
        ...base,
        group: 'homework',
        icon: ClipboardCheck,
        tone: 'neutral',
        title: e.homeworkGrade
          ? tr('Handed in “{title}” · {grade}', {
              title: e.homeworkTitle ?? '',
              grade: e.homeworkGrade
            })
          : tr('Handed in “{title}”', { title: e.homeworkTitle ?? '' })
      }
    case 'comment':
      return {
        ...base,
        group: 'comments',
        icon: MessageSquareText,
        tone: 'neutral',
        title: tr('Report card comment')
      }
  }
}

const TONE: Record<Row['tone'], string> = {
  good: 'text-[var(--color-success)]',
  bad: 'text-[var(--color-danger)]',
  neutral: 'text-[var(--color-text-muted)]'
}

/** Student page: everything recorded about this student, newest first, across all their
 * classes, with messages from the Portal when it's connected. */
export function StudentTimeline({ student }: { student: Student }): React.JSX.Element {
  const { data: events, isLoading } = useQuery({
    queryKey: ['studentTimeline', student.id],
    queryFn: () => window.api.studentTimeline.get(student.id)
  })
  const { data: settings } = useSettings()
  const connected = !!settings?.portalUrl.trim() && !!settings?.portalSyncSecret.trim()
  const { data: threads } = usePortalMessageThreads({ enabled: connected })

  const [hidden, setHidden] = useState<Set<Group>>(new Set())
  const [classFilter, setClassFilter] = useState('')
  const [shown, setShown] = useState(PAGE)

  const fullName = `${student.firstName} ${student.lastName}`
  const rows = useMemo(() => {
    const list: Row[] = (events ?? []).map(toRow)
    for (const t of threads ?? []) {
      const names = (t.studentNames ?? '').split(', ')
      if (!names.includes(fullName)) continue
      for (const m of t.messages) {
        list.push({
          group: 'messages',
          date: m.createdAt.slice(0, 10),
          at: m.createdAt,
          className: null,
          icon: MessageCircle,
          tone: 'neutral',
          title:
            m.sender === 'family'
              ? tr('Message from {who}', { who: t.username })
              : tr('Your message to {who}', { who: t.username }),
          text: m.body
        })
      }
    }
    return list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  }, [events, threads, fullName])

  const classNames = [...new Set(rows.map((r) => r.className).filter(Boolean))] as string[]
  const visible = rows.filter(
    (r) => !hidden.has(r.group) && (!classFilter || !r.className || r.className === classFilter)
  )
  const present = new Set(rows.map((r) => r.group))

  // A month heading above the first row of each month.
  const page = visible.slice(0, shown)
  const startsMonth = page.map(
    (r, i) => i === 0 || r.date.slice(0, 7) !== page[i - 1].date.slice(0, 7)
  )

  return (
    <Card className="mt-6">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <History size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Timeline')}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {tr(
            'Everything recorded about {name}, newest first, from every class: absences and lateness, scores, class points, notes and parent contacts, homework, report comments and Portal messages.',
            { name: student.firstName }
          )}
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {GROUPS.filter((g) => present.has(g.id)).map((g) => {
            const on = !hidden.has(g.id)
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h)
                    if (on) next.add(g.id)
                    else next.delete(g.id)
                    return next
                  })
                }
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs',
                  on
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                )}
              >
                {g.label()}
              </button>
            )
          })}
          {classNames.length > 1 && (
            <select
              aria-label={tr('Class')}
              className="ml-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-xs"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">{tr('All classes')}</option>
              {classNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">{tr('Loading…')}</p>
        ) : !visible.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">{tr('Nothing recorded yet.')}</p>
        ) : (
          <ol className="text-sm">
            {page.map((r, i) => {
              const month = r.date.slice(0, 7)
              const heading = startsMonth[i]
              const Icon = r.icon
              return (
                <li key={`${r.at}-${i}`}>
                  {heading && (
                    <h3 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] first:mt-0">
                      {formatDate(`${month}-01`, 'MMMM yyyy')}
                    </h3>
                  )}
                  <div className="flex gap-3 border-l border-[var(--color-border)] py-1.5 pl-3">
                    <span className="w-14 shrink-0 text-xs text-[var(--color-text-muted)]">
                      {formatDate(r.date, 'MMM d')}
                    </span>
                    <Icon size={14} className={cn('mt-0.5 shrink-0', TONE[r.tone])} aria-hidden />
                    <div className="min-w-0">
                      <p>
                        {r.title}
                        {r.className && (
                          <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                            {r.className}
                          </span>
                        )}
                      </p>
                      {r.text && (
                        <p className="whitespace-pre-wrap text-xs text-[var(--color-text-muted)]">
                          {r.text}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {visible.length > shown && (
          <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE)}>
            {tr('Show older ({n} more)', { n: visible.length - shown })}
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
