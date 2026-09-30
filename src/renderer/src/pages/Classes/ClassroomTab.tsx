import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dices,
  Eraser,
  Eye,
  EyeOff,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  Presentation,
  QrCode,
  RotateCcw,
  Shuffle,
  Star,
  Timer,
  Trophy,
  Undo2,
  Users
} from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { makeGroups, pickNext, startOfWeekIso } from '@shared/classroomTools'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Textarea } from '@renderer/components/ui/Field'
import { useAttendanceByClass, useClassRoster, useLessonPlans } from '@renderer/lib/queries'
import { PointCategoryChips } from '@renderer/components/PointCategoryChips'
import { todayIso } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { tr } from '@shared/i18n'

interface Kid {
  id: string
  name: string
}

/** Everyday tools for the lesson itself, built to be shown on the projector: a random
 * name picker, a group maker, a timer and class points. */
export function ClassroomTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: roster } = useClassRoster(classSection.id)
  const { data: attendance } = useAttendanceByClass(classSection.id)
  const [skipAbsent, setSkipAbsent] = useState(true)

  const today = todayIso()
  const awayToday = useMemo(
    () =>
      new Set(
        (attendance ?? [])
          .filter((r) => r.date === today && (r.status === 'absent' || r.status === 'excused'))
          .map((r) => r.studentId)
      ),
    [attendance, today]
  )
  const everyone: Kid[] = useMemo(
    () =>
      (roster ?? [])
        .filter((r) => r.enrollment.status === 'active')
        .map((r) => ({
          id: r.student.id,
          name: `${r.student.preferredName?.trim() || r.student.firstName} ${r.student.lastName}`
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  )
  const here = skipAbsent ? everyone.filter((k) => !awayToday.has(k.id)) : everyone

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={skipAbsent}
          onChange={(e) => setSkipAbsent(e.target.checked)}
        />
        {tr('Leave out students marked absent today')}
        {skipAbsent && awayToday.size > 0 && ` (${awayToday.size})`}
      </label>
      <ClassroomHubCard classId={classSection.id} />
      <div className="grid grid-cols-2 gap-4">
        <PickerCard kids={here} />
        <TimerCard />
        <GroupsCard kids={here} />
        <QuickBoardCard />
        <TeamScoreboardCard />
        <PointsCard classId={classSection.id} kids={everyone} />
      </div>
    </div>
  )
}


function ClassroomHubCard({ classId }: { classId: string }): React.JSX.Element {
  const { data: lessons } = useLessonPlans(classId)
  const { data: status, refetch } = useQuery({
    queryKey: ['classroomHub', classId],
    queryFn: () => window.api.classroomHub.getStatus(classId),
    refetchInterval: 2000
  })
  const today = todayIso()
  const defaultLesson =
    lessons?.find((lesson) => lesson.date === today) ??
    lessons?.find((lesson) => lesson.date > today && lesson.status === 'planned') ??
    lessons?.[0]
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const selected = selectedLessonId || defaultLesson?.id || ''
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!status?.url) return
    let cancelled = false
    window.api.exitTickets
      .getQrDataUrl(status.url)
      .then((value) => !cancelled && setQr(value))
      .catch(() => !cancelled && setQr(null))
    return () => {
      cancelled = true
    }
  }, [status?.url])

  async function open(): Promise<void> {
    if (!selected) return
    await window.api.classroomHub.open(classId, selected)
    await refetch()
  }

  async function project(): Promise<void> {
    if (!selected) return
    await window.api.classroomHub.project(classId, selected)
    await refetch()
  }

  async function close(): Promise<void> {
    await window.api.classroomHub.close(classId)
    await refetch()
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <QrCode size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Classroom Hub')}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Project this lesson directly from this computer, or share it over a local network.'
            )}
          </p>
        </div>
        {status?.open && (
          <span className="text-xs font-medium text-[var(--color-success)]">{tr('Open')}</span>
        )}
      </CardHeader>
      <CardBody>
        {!lessons?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">{tr('No lesson plans yet.')}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 text-xs font-medium text-[var(--color-text-muted)]">
              {tr('Lesson')}
              <select
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text)]"
                value={selected}
                onChange={(e) => setSelectedLessonId(e.target.value)}
              >
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.date} · {lesson.title}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" onClick={project}>
              <Maximize2 size={14} className="mr-1 inline" aria-hidden />
              {tr('Project lesson')}
            </Button>
            {status?.open ? (
              <Button variant="secondary" onClick={close}>
                {tr('Close hub')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={open}>
                {tr('Share to devices')}
              </Button>
            )}
          </div>
        )}
        {status?.open && !status.url && (
          <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Projector mode is running on this computer. Student-device sharing needs a local network.'
            )}
          </p>
        )}
        {status?.open && status.url && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            {qr && (
              <img
                src={qr}
                alt={tr('Classroom Hub QR code')}
                className="h-32 w-32 rounded-md bg-white p-1"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{status.title}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {tr('Students scan this QR code while they are on the same classroom Wi-Fi.')}
              </p>
              <p className="mt-2 break-all font-mono text-xs text-[var(--color-text-muted)]">
                {status.url}
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function QuickBoardCard(): React.JSX.Element {
  const [text, setText] = useState('')
  const [revealed, setRevealed] = useState(true)
  const [size, setSize] = useState<'md' | 'lg' | 'xl'>('lg')
  const board = useRef<HTMLDivElement>(null)
  const sizeClass = size === 'md' ? 'text-3xl' : size === 'xl' ? 'text-7xl' : 'text-5xl'

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Presentation size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Quick Board')}
        </h2>
        <button
          aria-label={tr('Full screen')}
          title={tr('Full screen')}
          className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          onClick={() => void board.current?.requestFullscreen()}
        >
          <Maximize2 size={15} aria-hidden />
        </button>
      </CardHeader>
      <CardBody className="space-y-3">
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tr('Type a question, sentence, model answer or instructions…')}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setRevealed((v) => !v)}>
            {revealed ? (
              <EyeOff size={13} className="mr-1 inline" aria-hidden />
            ) : (
              <Eye size={13} className="mr-1 inline" aria-hidden />
            )}
            {revealed ? tr('Hide') : tr('Reveal')}
          </Button>
          {(['md', 'lg', 'xl'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={size === value ? 'primary' : 'ghost'}
              onClick={() => setSize(value)}
            >
              {value === 'md' ? tr('Medium') : value === 'lg' ? tr('Large') : tr('Huge')}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText('')
              setRevealed(true)
            }}
          >
            <Eraser size={13} className="mr-1 inline" aria-hidden />
            {tr('Clear')}
          </Button>
        </div>
        <div
          ref={board}
          onClick={() => setRevealed((v) => !v)}
          className={cn(
            'flex min-h-44 cursor-pointer items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center font-semibold leading-tight whitespace-pre-wrap',
            sizeClass,
            '[:fullscreen_&]:min-h-screen [:fullscreen_&]:border-0 [:fullscreen_&]:p-16 [:fullscreen_&]:text-[8vw]'
          )}
          title={tr('Click to hide or reveal')}
        >
          {revealed ? text || tr('Ready') : '••••••'}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr('Click the board to hide or reveal it. Full screen works without internet.')}
        </p>
      </CardBody>
    </Card>
  )
}

interface Team {
  id: number
  name: string
  score: number
}

function TeamScoreboardCard(): React.JSX.Element {
  const [teams, setTeams] = useState<Team[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: tr('Team {n}', { n: i + 1 }), score: 0 }))
  )
  const board = useRef<HTMLDivElement>(null)

  const changeScore = (id: number, by: number): void =>
    setTeams((old) => old.map((team) => (team.id === id ? { ...team, score: team.score + by } : team)))

  return (
    <Card className="col-span-2">
      <div ref={board} className="bg-[var(--color-surface)]">
        <CardHeader className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Trophy size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Team Scoreboard')}
          </h2>
          <div className="flex gap-1">
            <button
              aria-label={tr('Full screen')}
              title={tr('Full screen')}
              className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              onClick={() =>
                document.fullscreenElement
                  ? void document.exitFullscreen()
                  : void board.current?.requestFullscreen()
              }
            >
              <Maximize2 size={15} aria-hidden />
            </button>
            <button
              aria-label={tr('Reset scores')}
              title={tr('Reset scores')}
              className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              onClick={() => setTeams((old) => old.map((team) => ({ ...team, score: 0 })))}
            >
              <RotateCcw size={15} aria-hidden />
            </button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-xl border border-[var(--color-border)] p-3 text-center [:fullscreen_&]:p-8"
              >
                <input
                  aria-label={tr('Team name')}
                  value={team.name}
                  onChange={(e) =>
                    setTeams((old) =>
                      old.map((item) =>
                        item.id === team.id ? { ...item, name: e.target.value.slice(0, 30) } : item
                      )
                    )
                  }
                  className="w-full bg-transparent text-center text-sm font-semibold outline-none [:fullscreen_&]:text-3xl"
                />
                <p className="my-3 text-5xl font-bold tabular-nums [:fullscreen_&]:my-8 [:fullscreen_&]:text-[9vw]">
                  {team.score}
                </p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => changeScore(team.id, -1)}>
                    <Minus size={14} aria-hidden />
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => changeScore(team.id, 1)}>
                    <Plus size={14} aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </div>
    </Card>
  )
}

function PickerCard({ kids }: { kids: Kid[] }): React.JSX.Element {
  const [picked, setPicked] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const byId = new Map(kids.map((k) => [k.id, k.name]))
  const left = kids.filter((k) => !picked.includes(k.id)).length

  function pick(): void {
    const r = pickNext(
      kids.map((k) => k.id),
      picked
    )
    if (!r.pick) return
    // A short shuffle through names before landing, so the class can see it's random.
    setRolling(true)
    let n = 0
    const timer = setInterval(() => {
      setCurrent(kids[Math.floor(Math.random() * kids.length)].id)
      if (++n >= 10) {
        clearInterval(timer)
        setCurrent(r.pick)
        setPicked(r.picked)
        setRolling(false)
      }
    }, 60)
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Dices size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Random name')}
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {kids.length
            ? tr('{left} of {length} not picked yet', { left, length: kids.length })
            : ''}
        </span>
      </CardHeader>
      <CardBody className="flex flex-col items-center gap-4 py-8">
        <p
          className={cn(
            'min-h-12 text-center text-4xl font-semibold tracking-tight',
            rolling && 'text-[var(--color-text-muted)]'
          )}
          aria-live="polite"
        >
          {current ? byId.get(current) : kids.length ? '—' : tr('No students here')}
        </p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={pick} disabled={!kids.length || rolling}>
            {tr('Pick a name')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setPicked([])
              setCurrent(null)
            }}
            disabled={!picked.length}
          >
            {tr('Start again')}
          </Button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr('Nobody is picked twice until everyone has had a turn.')}
        </p>
      </CardBody>
    </Card>
  )
}

function GroupsCard({ kids }: { kids: Kid[] }): React.JSX.Element {
  const [mode, setMode] = useState<'size' | 'count'>('size')
  const [n, setN] = useState(4)
  const [groups, setGroups] = useState<Kid[][]>([])
  const make = (): void => setGroups(makeGroups(kids, mode === 'size' ? { size: n } : { count: n }))

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Groups')}
        </h2>
        <div className="flex items-center gap-1.5 text-sm">
          <select
            aria-label={tr('Group by')}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'size' | 'count')}
          >
            <option value="size">{tr('Groups of')}</option>
            <option value="count">{tr('Number of groups')}</option>
          </select>
          <input
            aria-label={tr('How many')}
            type="number"
            min={1}
            max={40}
            className="w-14 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1"
            value={n}
            onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))}
          />
          <Button variant="primary" size="sm" onClick={make} disabled={!kids.length}>
            <Shuffle size={13} className="mr-1 inline" aria-hidden />
            {groups.length ? tr('Shuffle') : tr('Make groups')}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {groups.length ? (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {groups.map((g, i) => (
              <div key={i} className="rounded-lg border border-[var(--color-border)] p-2">
                <p className="mb-1 text-xs font-semibold text-[var(--color-primary)]">
                  {tr('Group {n}', { n: i + 1 })}
                </p>
                <ul className="text-sm">
                  {g.map((k) => (
                    <li key={k.id}>{k.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr('Random groups from the students here today. Shuffle until you like them.')}
          </p>
        )}
      </CardBody>
    </Card>
  )
}

const PRESETS = [1, 2, 3, 5, 10, 15]

function chime(): void {
  try {
    const ctx = new AudioContext()
    ;[0, 0.25, 0.5].forEach((at, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = [880, 988, 1175][i]
      gain.gain.setValueAtTime(0.25, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.45)
    })
  } catch {
    // No sound available; the screen still shows time's up.
  }
}

function TimerCard(): React.JSX.Element {
  const [total, setTotal] = useState(5 * 60)
  const [left, setLeft] = useState(5 * 60)
  const [running, setRunning] = useState(false)
  const endAt = useRef(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt.current - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) {
        setRunning(false)
        chime()
      }
    }, 250)
    return () => clearInterval(t)
  }, [running])

  const set = (seconds: number): void => {
    setRunning(false)
    setTotal(seconds)
    setLeft(seconds)
  }
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const done = left === 0 && total > 0

  return (
    <Card>
      <div ref={box} className="bg-[var(--color-surface)]">
        <CardHeader className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Timer size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Timer')}
          </h2>
          <button
            aria-label={tr('Full screen')}
            title={tr('Full screen')}
            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            onClick={() =>
              document.fullscreenElement
                ? void document.exitFullscreen()
                : void box.current?.requestFullscreen()
            }
          >
            <Maximize2 size={15} aria-hidden />
          </button>
        </CardHeader>
        <CardBody className="flex flex-col items-center gap-4 py-6">
          <p
            className={cn(
              'font-mono text-6xl font-semibold tabular-nums [:fullscreen_&]:text-[22vw]',
              done && 'text-[var(--color-danger)]'
            )}
            aria-live="polite"
          >
            {done ? tr("Time's up") : `${mm}:${ss}`}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {PRESETS.map((m) => (
              <button
                key={m}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs',
                  total === m * 60
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                )}
                onClick={() => set(m * 60)}
              >
                {tr('{m} min', { m })}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                if (running) {
                  setRunning(false)
                } else {
                  const from = left === 0 ? total : left
                  setLeft(from)
                  endAt.current = Date.now() + from * 1000
                  setRunning(true)
                }
              }}
            >
              {running ? (
                <Pause size={14} className="mr-1 inline" aria-hidden />
              ) : (
                <Play size={14} className="mr-1 inline" aria-hidden />
              )}
              {running ? tr('Pause') : left < total && left > 0 ? tr('Resume') : tr('Start')}
            </Button>
            <Button variant="ghost" onClick={() => set(total)}>
              <RotateCcw size={14} className="mr-1 inline" aria-hidden />
              {tr('Reset')}
            </Button>
          </div>
        </CardBody>
      </div>
    </Card>
  )
}

function PointsCard({ classId, kids }: { classId: string; kids: Kid[] }): React.JSX.Element {
  const qc = useQueryClient()
  const week = startOfWeekIso()
  const key = ['behaviourPoints', classId, week]
  const { data: totals } = useQuery({
    queryKey: key,
    queryFn: () => window.api.behaviourPoints.totals(classId, week)
  })
  const [category, setCategory] = useState<string | null>(null)
  const byId = new Map((totals ?? []).map((t) => [t.studentId, t]))
  const refresh = (): void => void qc.invalidateQueries({ queryKey: key })

  async function give(studentId: string, points: number): Promise<void> {
    await window.api.behaviourPoints.add({ classId, studentId, points, category })
    refresh()
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Star size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Class points this week')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await window.api.behaviourPoints.undoLast(classId)
            refresh()
          }}
        >
          <Undo2 size={13} className="mr-1 inline" aria-hidden />
          {tr('Undo last')}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        <PointCategoryChips value={category} onChange={setCategory} />
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-6">
          {kids.map((k) => {
            const t = byId.get(k.id)
            return (
              <div
                key={k.id}
                className="flex items-center overflow-hidden rounded-lg border border-[var(--color-border)]"
              >
                <button
                  className="flex min-w-0 flex-1 items-center justify-between gap-1 px-2 py-2 text-left text-sm hover:bg-[var(--color-primary-soft)]"
                  onClick={() => give(k.id, 1)}
                  title={tr('+1 for {name}', { name: k.name })}
                >
                  <span className="truncate">{k.name}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 text-xs font-semibold',
                      (t?.week ?? 0) < 0
                        ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                        : 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                    )}
                  >
                    {t?.week ?? 0}
                  </span>
                </button>
                <button
                  aria-label={tr('−1 for {name}', { name: k.name })}
                  title={tr('−1 for {name}', { name: k.name })}
                  className="border-l border-[var(--color-border)] px-2 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  onClick={() => give(k.id, -1)}
                >
                  −
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'Tap a name for +1, or − to take one away. Totals start again each Monday; the all-time total is kept. Change what points are for in Settings → Class lists.'
          )}
        </p>
      </CardBody>
    </Card>
  )
}
