import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Gauge, Play, Plus, RotateCcw, Square, Trash2, Wifi } from 'lucide-react'
import type { ClassSection, ExitTicketQuestion, ExitTicketQuestionType } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useClassRoster,
  useClearExitTicketResponses,
  useExitTicket,
  useExitTicketResponses,
  useExitTicketServerInfo,
  useSetExitTicketOpen,
  useUpsertExitTicket
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { tr } from '@shared/i18n'
import { confidenceQuestion, summarizeExitTicket } from '@shared/exitTicketSummary'
import type { ExitTicketResponse } from '@shared/types'

const MAX_QUESTIONS = 3

function newQuestion(): ExitTicketQuestion {
  return { id: crypto.randomUUID(), prompt: '', type: 'text' }
}

export function ExitTicketTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: ticket, isLoading } = useExitTicket(classSection.id)
  const upsertTicket = useUpsertExitTicket(classSection.id)
  const setOpen = useSetExitTicketOpen(classSection.id)

  const [title, setTitle] = useState(ticket?.title ?? tr('Exit Ticket'))
  const [questions, setQuestions] = useState<ExitTicketQuestion[]>(
    ticket?.questions.length ? ticket.questions : [newQuestion()]
  )
  const [loadedTicketId, setLoadedTicketId] = useState<string | null>(null)

  // Hydrate the editor from the saved ticket once, during render (not an effect) —
  // same resync pattern used throughout this codebase (see ScoreCell.lastSeenPoints).
  if (ticket && loadedTicketId !== ticket.id) {
    setLoadedTicketId(ticket.id)
    setTitle(ticket.title)
    setQuestions(ticket.questions.length ? ticket.questions : [newQuestion()])
  }

  function updateQuestion(index: number, patch: Partial<ExitTicketQuestion>): void {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function addQuestion(): void {
    if (questions.length >= MAX_QUESTIONS) return
    setQuestions((prev) => [...prev, newQuestion()])
  }

  function removeQuestion(index: number): void {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave(): Promise<void> {
    await upsertTicket.mutateAsync({
      classId: classSection.id,
      title: title.trim() || tr('Exit Ticket'),
      questions: questions
        .filter((q) => q.prompt.trim())
        .map((q) => ({
          ...q,
          prompt: q.prompt.trim(),
          options: q.type === 'choice' ? (q.options ?? []).filter(Boolean) : undefined,
          goodOptions:
            q.type === 'choice'
              ? (q.goodOptions ?? []).filter((i) => i < (q.options ?? []).filter(Boolean).length)
              : undefined
        }))
    })
  }

  const canSave = questions.some((q) => q.prompt.trim())

  if (isLoading) return <Spinner />

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">{tr('Questions')}</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <FormRow label={tr('Title')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormRow>

          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  {tr('Question')} {i + 1}
                </span>
                <button
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] disabled:opacity-30"
                  onClick={() => removeQuestion(i)}
                  disabled={questions.length === 1}
                  aria-label={tr('Remove question')}
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    value={q.prompt}
                    onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                    placeholder={tr("e.g. What's one thing you learned today?")}
                  />
                </div>
                <Select
                  value={q.type}
                  onChange={(e) =>
                    updateQuestion(i, { type: e.target.value as ExitTicketQuestionType })
                  }
                >
                  <option value="text">{tr('Short answer')}</option>
                  <option value="choice">{tr('Multiple choice')}</option>
                </Select>
              </div>
              {q.type === 'choice' && (
                <Input
                  className="mt-2"
                  value={(q.options ?? []).join(', ')}
                  onChange={(e) =>
                    updateQuestion(i, { options: e.target.value.split(',').map((o) => o.trim()) })
                  }
                  placeholder={tr('Options, comma-separated (e.g. Yes, No, Not sure)')}
                />
              )}
              {q.type === 'choice' && (q.options ?? []).filter(Boolean).length > 0 && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                  <p className="mb-1">
                    {tr(
                      'Tick the answers that show a student understood (for the re-teach check):'
                    )}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {(q.options ?? []).filter(Boolean).map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={(q.goodOptions ?? []).includes(oi)}
                          onChange={(e) =>
                            updateQuestion(i, {
                              goodOptions: e.target.checked
                                ? [...(q.goodOptions ?? []), oi]
                                : (q.goodOptions ?? []).filter((x) => x !== oi)
                            })
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={addQuestion}
              disabled={questions.length >= MAX_QUESTIONS}
            >
              <Plus size={13} className="mr-1 inline" aria-hidden />
              {tr('Question')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setQuestions((prev) => [
                  ...prev.filter((q) => q.prompt.trim()),
                  confidenceQuestion(crypto.randomUUID())
                ])
              }
              disabled={questions.filter((q) => q.prompt.trim()).length >= MAX_QUESTIONS}
            >
              <Gauge size={13} className="mr-1 inline" aria-hidden />
              {tr('Confidence check')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!canSave || upsertTicket.isPending}
            >
              {upsertTicket.isPending ? tr('Saving…') : tr('Save')}
            </Button>
          </div>
        </CardBody>
      </Card>

      {ticket && (
        <ResultsCard
          classId={classSection.id}
          ticketId={ticket.id}
          isOpen={ticket.isOpen}
          questions={ticket.questions}
        />
      )}

      {ticket && (
        <SessionPanel
          classId={classSection.id}
          ticketId={ticket.id}
          isOpen={ticket.isOpen}
          closesAt={ticket.closesAt}
          onToggleOpen={(open, autoCloseMinutes) =>
            setOpen.mutate({ id: ticket.id, isOpen: open, autoCloseMinutes })
          }
          toggling={setOpen.isPending}
        />
      )}
    </div>
  )
}

/** What the answers say about the lesson: each choice question's spread, and a re-teach
 * suggestion when fewer than 70% chose an answer marked as showing understanding. Stays
 * after the session closes, until the answers are cleared. */
function ResultsCard({
  classId,
  ticketId,
  isOpen,
  questions
}: {
  classId: string
  ticketId: string
  isOpen: boolean
  questions: ExitTicketQuestion[]
}): React.JSX.Element | null {
  const { data: responses } = useExitTicketResponses(ticketId, isOpen)
  if (!responses?.length) return null
  const summary = summarizeExitTicket(questions, responses as ExitTicketResponse[])
  const reteach = summary.filter((q) => q.reteach)
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold">
          {tr('What the answers say ({n} students)', { n: responses.length })}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4 text-sm">
        {reteach.length > 0 && (
          <div className="rounded-lg bg-[var(--color-warning-soft)] p-3 text-[var(--color-warning)]">
            <p className="font-medium">
              {tr('Worth re-teaching before moving on:')}{' '}
              {reteach.map((q) => `“${q.prompt}”`).join(', ')}
            </p>
            <p className="mt-1 text-xs">
              {tr(
                'Fewer than 7 in 10 showed they understood. Mark the lesson “Partly taught” and move the plan back, or open the next lesson with a short recap.'
              )}{' '}
              <Link to={`/classes/${classId}/lessons`} className="underline">
                {tr('Open lesson plans')}
              </Link>
            </p>
          </div>
        )}
        {summary.map((q) => (
          <div key={q.id}>
            <p className="font-medium">
              {q.prompt}{' '}
              {q.understood !== null && (
                <span
                  className={
                    'ml-1 text-xs ' +
                    (q.reteach ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')
                  }
                >
                  {tr('{percent}% understood', { percent: Math.round(q.understood * 100) })}
                </span>
              )}
            </p>
            {q.options.map((o) => (
              <div key={o.label} className="mt-1 flex items-center gap-2 text-xs">
                <span className="w-48 truncate">{o.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded bg-[var(--color-surface-muted)]">
                  <span
                    className="block h-full"
                    style={{
                      width: `${q.answered ? (o.count / q.answered) * 100 : 0}%`,
                      background: o.good ? 'var(--color-success)' : 'var(--color-primary)'
                    }}
                  />
                </span>
                <span className="w-6 text-right">{o.count}</span>
              </div>
            ))}
            {q.texts.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--color-text-muted)]">
                {q.texts.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

function SessionPanel({
  classId,
  ticketId,
  isOpen,
  closesAt,
  onToggleOpen,
  toggling
}: {
  classId: string
  ticketId: string
  isOpen: boolean
  closesAt: string | null
  onToggleOpen: (open: boolean, autoCloseMinutes?: number | null) => void
  toggling: boolean
}): React.JSX.Element {
  const [autoClose, setAutoClose] = useState<number>(10)
  const { data: roster } = useClassRoster(classId)
  const { data: serverInfo } = useExitTicketServerInfo(isOpen)
  const { data: responses } = useExitTicketResponses(ticketId, isOpen)
  const clearResponses = useClearExitTicketResponses(ticketId)
  const [confirmClear, setConfirmClear] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // Students who haven't answered yet (responses from before names came from the roster
  // carry no student id, so they can't be matched and don't count).
  const answered = new Set((responses ?? []).map((r) => r.studentId).filter(Boolean))
  const notAnswered = (roster ?? [])
    .filter((r) => r.enrollment.status === 'active' && !answered.has(r.student.id))
    .map((r) => `${r.student.preferredName?.trim() || r.student.firstName} ${r.student.lastName}`)

  // The server's routes are keyed by class id (getExitTicketByClass), not the ticket's
  // own id — a class has at most one ticket, so the class id is the stable, natural key
  // for the URL a student's device hits.
  const studentUrl = serverInfo?.url ? `${serverInfo.url}/t/${classId}` : null

  // Fetch the QR code once we have a URL to encode — during render, guarded, rather
  // than an effect, since it's a one-shot derived value keyed to the URL string.
  const [qrForUrl, setQrForUrl] = useState<string | null>(null)
  if (studentUrl && qrForUrl !== studentUrl) {
    setQrForUrl(studentUrl)
    window.api.exitTickets.getQrDataUrl(studentUrl).then(setQrDataUrl)
  } else if (!studentUrl && qrForUrl !== null) {
    setQrForUrl(null)
    setQrDataUrl(null)
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Wifi size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Session')}
        </h2>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              {tr('Close by itself after')}
              <select
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-text)]"
                value={autoClose}
                onChange={(e) => setAutoClose(Number(e.target.value))}
              >
                <option value={5}>{tr('5 minutes')}</option>
                <option value={10}>{tr('10 minutes')}</option>
                <option value={15}>{tr('15 minutes')}</option>
                <option value={30}>{tr('30 minutes')}</option>
                <option value={0}>{tr('Never')}</option>
              </select>
            </label>
          )}
          <Button
            variant={isOpen ? 'danger' : 'primary'}
            size="sm"
            onClick={() => onToggleOpen(!isOpen, isOpen ? null : autoClose || null)}
            disabled={toggling}
          >
            {isOpen ? (
              <>
                <Square size={13} className="mr-1 inline" aria-hidden />
                {tr('Stop session')}
              </>
            ) : (
              <>
                <Play size={13} className="mr-1 inline" aria-hidden />
                {tr('Start session')}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {!isOpen ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr(
              "Start a session to let students submit answers from their own devices on this classroom's WiFi — no internet, no app to install, nothing to sign in to."
            )}
          </p>
        ) : (
          <>
            <div className="flex items-start gap-4">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={tr('QR code to the exit ticket')}
                  className="h-32 w-32 rounded-lg border border-[var(--color-border)]"
                />
              )}
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {tr('Students on this WiFi go to:')}
                </p>
                <p className="mt-1 break-all text-lg font-semibold">{studentUrl ?? '…'}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'Students choose their name from the class list; answering again replaces their earlier answer.'
                  )}
                  {closesAt &&
                    tr(' Closes by itself at {date}.', { date: formatDate(closesAt, 'p') })}
                </p>
                {!serverInfo?.lanIp && (
                  <p className="mt-2 text-xs text-[var(--color-warning)]">
                    {tr(
                      "Couldn't detect a network address — make sure this computer is connected to the classroom WiFi (not just powered on)."
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <h3 className="text-sm font-semibold">
                {tr('Responses {count}', { count: responses ? `(${responses.length})` : '' })}
              </h3>
              <button
                className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                onClick={() => setConfirmClear(true)}
              >
                <RotateCcw size={12} aria-hidden />
                {tr('Clear')}
              </button>
            </div>
            {notAnswered.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">
                <span className="font-medium text-[var(--color-text)]">
                  {tr('Not answered yet ({length}):', { length: notAnswered.length })}
                </span>{' '}
                {notAnswered.join(', ')}
              </p>
            )}
            {!responses?.length ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {tr("No responses yet — they'll appear here as students submit.")}
              </p>
            ) : (
              <ul className="max-h-96 space-y-3 overflow-auto">
                {responses.map((r) => (
                  <li key={r.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{r.studentName}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDate(r.submittedAt, 'p')}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-[var(--color-text-muted)]">
                      {Object.values(r.answers).map((answer, i) => (
                        <p key={i}>{answer}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirmClear}
        title={tr('Clear responses')}
        message={tr("Delete all responses for this session? This can't be undone.")}
        confirmLabel={tr('Clear')}
        danger
        onConfirm={async () => {
          await clearResponses.mutateAsync()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </Card>
  )
}
