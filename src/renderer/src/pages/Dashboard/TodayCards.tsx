import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock3,
  NotebookPen,
  PhoneCall,
  Presentation,
  Sun,
  UserSearch
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { tr, trn } from '@shared/i18n'
import { todayLessonFocus } from '@shared/todayFocus'

/** Today's lessons from the timetable: is attendance taken, is there a plan. */
export function TodayCard(): React.JSX.Element | null {
  const { data: today } = useQuery({
    queryKey: ['today', 'overview'],
    queryFn: () => window.api.today.overview(),
    // Attendance and plans change on other pages; show them as they are now.
    staleTime: 0,
    refetchInterval: 60_000
  })
  if (!today || (!today.lessons.length && !today.followUpsDue)) return null
  const focus = todayLessonFocus(today.lessons)
  const focusLesson = focus ? today.lessons[focus.index] : null

  return (
    <Card className="mb-6">
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sun size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Today')}
        </h2>
        {today.followUpsDue > 0 && (
          <Link
            to="/communications"
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            <PhoneCall size={12} aria-hidden />
            {trn(
              '{followUpsDue} parent follow-up due',
              '{followUpsDue} parent follow-ups due',
              today.followUpsDue,
              { followUpsDue: today.followUpsDue }
            )}
          </Link>
        )}
      </CardHeader>
      <CardBody className="p-0">
        {focusLesson && focus && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  <Clock3 size={13} aria-hidden />
                  {focus.state === 'current' ? tr('Now') : tr('Next lesson')}
                </p>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    to={`/classes/${focusLesson.classId}`}
                    className="truncate text-base font-semibold hover:underline"
                  >
                    {focusLesson.className}
                  </Link>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {focusLesson.startTime}–{focusLesson.endTime}
                    {focusLesson.room ? ` · ${focusLesson.room}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {focusLesson.lessonPlanTitle ?? tr('No plan yet')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/classes/${focusLesson.classId}/attendance`}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--color-bg)]"
                >
                  <CalendarCheck size={13} aria-hidden />
                  {focusLesson.attendanceTaken ? tr('Attendance') : tr('Take attendance')}
                </Link>
                <Link
                  to={`/classes/${focusLesson.classId}/lessons`}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--color-bg)]"
                >
                  <NotebookPen size={13} aria-hidden />
                  {tr('Lesson plan')}
                </Link>
                <Link
                  to={`/classes/${focusLesson.classId}/classroom`}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  <Presentation size={13} aria-hidden />
                  {tr('Classroom tools')}
                </Link>
              </div>
            </div>
          </div>
        )}
        {today.lessons.length ? (
          <ul>
            {today.lessons.map((l, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-t border-[var(--color-border)] px-5 py-2.5 text-sm first:border-t-0"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-[var(--color-text-muted)]">
                  {l.startTime}–{l.endTime}
                </span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: l.classColor ?? 'var(--color-primary)' }}
                  aria-hidden
                />
                <Link
                  to={`/classes/${l.classId}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {l.className}
                  {l.room && (
                    <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">
                      {l.room}
                    </span>
                  )}
                </Link>
                <Link
                  to={`/classes/${l.classId}/lessons`}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <NotebookPen size={12} aria-hidden />
                  {l.lessonPlanTitle ?? tr('No plan yet')}
                </Link>
                <Link
                  to={`/classes/${l.classId}/attendance`}
                  className={
                    l.attendanceTaken
                      ? 'flex items-center gap-1 text-xs text-[var(--color-success)]'
                      : 'flex items-center gap-1 text-xs font-medium text-[var(--color-warning)]'
                  }
                >
                  {l.attendanceTaken ? (
                    <CheckCircle2 size={12} aria-hidden />
                  ) : (
                    <Circle size={12} aria-hidden />
                  )}
                  {l.attendanceTaken ? tr('Attendance taken') : tr('Take attendance')}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-3 text-sm text-[var(--color-text-muted)]">
            {tr('No lessons on your timetable today.')}
          </p>
        )}
      </CardBody>
    </Card>
  )
}

/** Students below the pass mark, falling, or with repeated concerns. */
export function WatchListCard(): React.JSX.Element | null {
  const { data: list } = useQuery({
    queryKey: ['today', 'watchList'],
    queryFn: () => window.api.today.watchList(),
    staleTime: 0
  })
  if (!list?.length) return null
  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <UserSearch size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Students to check on ({length})', { length: list.length })}
        </h2>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="max-h-72 overflow-auto">
          {list.map((e) => (
            <li
              key={`${e.studentId}-${e.classId}`}
              className="flex items-start gap-3 border-t border-[var(--color-border)] px-5 py-2.5 text-sm first:border-t-0"
            >
              <AlertCircle
                size={14}
                className="mt-0.5 shrink-0 text-[var(--color-warning)]"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <Link to={`/students/${e.studentId}`} className="font-medium hover:underline">
                  {e.studentName}
                </Link>
                <span className="text-[var(--color-text-muted)]"> · {e.className}</span>
                <p className="text-xs text-[var(--color-text-muted)]">{e.reasons.join(' · ')}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
