import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Check, Sparkles, WifiOff } from 'lucide-react'
import type { ClassRosterRow, ClassSection } from '@shared/types'
import {
  appendSentence,
  COMMENT_CATEGORIES,
  fillComment,
  type PhraseSuggestion
} from '@shared/commentBank'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { useSettings } from '@renderer/lib/queries'
import { formatPercent, ipcErrorMessage } from '@renderer/lib/format'
import { classifyTrend } from '@renderer/lib/trend'
import { cn } from '@renderer/lib/cn'
import { tr } from '@shared/i18n'

/** Report card comments for every student in the class: write each one, add sentences
 * from the comment bank, or take short AI-suggested phrases (with what they're based on)
 * as a starting point. Comments print on the report cards. */
export function ReportComments({
  classSection,
  roster
}: {
  classSection: ClassSection
  roster: ClassRosterRow[]
}): React.JSX.Element {
  const { data: comments } = useQuery({
    queryKey: ['reportComments', classSection.id],
    queryFn: () => window.api.reportComments.list(classSection.id)
  })
  const [params] = useSearchParams()
  const focus = params.get('student')
  const students = roster
    .filter((r) => r.enrollment.status === 'active')
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName))
  const written = students.filter((r) =>
    comments?.some((c) => c.studentId === r.student.id && c.text.trim())
  ).length

  return (
    <Card id="comments">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{tr('Report card comments')}</h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {tr('{written} of {length} written', { written, length: students.length })}
        </span>
      </CardHeader>
      <CardBody className="space-y-4">
        {students.map((r) => (
          <CommentRow
            key={r.student.id}
            classSection={classSection}
            row={r}
            saved={comments?.find((c) => c.studentId === r.student.id)?.text ?? ''}
            autoFocus={focus === r.student.id}
          />
        ))}
      </CardBody>
    </Card>
  )
}

function CommentRow({
  classSection,
  row,
  saved,
  autoFocus
}: {
  classSection: ClassSection
  row: ClassRosterRow
  saved: string
  autoFocus: boolean
}): React.JSX.Element {
  const qc = useQueryClient()
  const { data: settings } = useSettings()
  const [text, setText] = useState(saved)
  const [seen, setSeen] = useState(saved)
  if (saved !== seen) {
    setSeen(saved)
    setText(saved)
  }
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [bankOpen, setBankOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<PhraseSuggestion[] | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const name = row.student.preferredName?.trim() || row.student.firstName
  const fullName = `${name} ${row.student.lastName}`
  const ctx = {
    name,
    className: classSection.name,
    grade: row.grade.letter,
    percent: row.grade.percent
  }

  useEffect(() => {
    if (autoFocus)
      document.getElementById(`comment-${row.student.id}`)?.scrollIntoView({ block: 'center' })
  }, [autoFocus, row.student.id])

  async function save(value: string): Promise<void> {
    if (value.trim() === saved.trim()) return
    setStatus('saving')
    await window.api.reportComments.set(classSection.id, row.student.id, value)
    await qc.invalidateQueries({ queryKey: ['reportComments', classSection.id] })
    setStatus('saved')
  }

  function add(sentence: string): void {
    const next = appendSentence(text, sentence)
    setText(next)
    void save(next)
  }

  async function suggest(): Promise<void> {
    setSuggesting(true)
    setAiError(null)
    try {
      const [trend, notes] = await Promise.all([
        window.api.reports.studentGradeTrend(row.student.id, classSection.id),
        window.api.studentLogEntries.listByStudent(row.student.id)
      ])
      const t = classifyTrend(trend)
      setSuggestions(
        await window.api.ai.suggestCommentPhrases({
          studentName: name,
          className: classSection.name,
          percent: row.grade.percent,
          letter: row.grade.letter,
          attendanceRate: row.attendanceRate,
          recentNotes: notes.slice(0, 5).map((n) => n.text),
          trendDirection: t?.direction ?? null,
          trendDeltaPoints: t?.deltaPoints ?? null
        })
      )
    } catch (err) {
      setAiError(ipcErrorMessage(err, tr('No suggestions right now.')))
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{fullName}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatPercent(row.grade.percent)} {row.grade.letter ?? ''}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {status === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
              <Check size={12} aria-hidden /> {tr('Saved')}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setBankOpen(true)}>
            <BookOpen size={13} className="mr-1 inline" aria-hidden />
            {tr('Comment bank')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={suggest}
            disabled={suggesting}
            title={tr('Uses your AI provider (Settings), so it needs an internet connection')}
          >
            <Sparkles size={13} className="mr-1 inline" aria-hidden />
            {suggesting ? tr('Thinking…') : tr('Suggest phrases')}
          </Button>
          <span className="text-[10px] text-[var(--color-text-muted)]">{tr('needs internet')}</span>
        </span>
      </div>
      <textarea
        id={`comment-${row.student.id}`}
        aria-label={tr('Report comment for {fullName}', { fullName })}
        autoFocus={autoFocus}
        className="min-h-20 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm"
        value={text}
        placeholder={tr("Write {name}'s comment, or add sentences from the comment bank.", {
          name
        })}
        onChange={(e) => {
          setText(e.target.value)
          setStatus('idle')
        }}
        onBlur={() => void save(text)}
      />
      {text.includes('{') && (
        <p className="mt-1 text-xs text-[var(--color-warning)]">
          {tr('A placeholder like {grade} couldn’t be filled yet; edit it before printing.')}
        </p>
      )}
      {aiError && (
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-danger)]">
          <WifiOff size={12} aria-hidden /> {aiError}
        </p>
      )}
      {suggestions && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              'AI suggestions (needs internet). Each says what it’s based on; check it before adding. Click one to add it.'
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.phrase}
                className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-left text-xs hover:border-[var(--color-primary)]"
                onClick={() => add(s.phrase)}
              >
                {s.phrase}
                <span className="ml-1.5 rounded bg-[var(--color-surface-muted)] px-1 text-[10px] uppercase text-[var(--color-text-muted)]">
                  {s.basis}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        title={tr('Comment bank — {name}', { name })}
        wide
      >
        <div className="max-h-[60vh] space-y-4 overflow-auto">
          {COMMENT_CATEGORIES.map((cat) => {
            const items = (settings?.commentBank ?? []).filter((c) => c.category === cat)
            if (!items.length) return null
            return (
              <section key={cat}>
                <h3 className="mb-1 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  {tr(cat)}
                </h3>
                <div className="space-y-1">
                  {items.map((c, i) => (
                    <button
                      key={i}
                      className={cn(
                        'block w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-left text-sm',
                        'hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'
                      )}
                      onClick={() => {
                        add(fillComment(c.text, ctx))
                        setBankOpen(false)
                      }}
                    >
                      {fillComment(c.text, ctx)}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr('Edit these in Settings → Your lists.')}
          </p>
        </div>
      </Modal>
    </div>
  )
}
